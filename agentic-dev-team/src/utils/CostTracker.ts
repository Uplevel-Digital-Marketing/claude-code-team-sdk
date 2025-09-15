import { Logger } from "./Logger.js";

export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  total_cost_usd?: number;
}

export interface StepUsage {
  messageId: string;
  timestamp: string;
  usage: UsageData;
  costUSD: number;
}

export class CostTracker {
  private processedMessageIds = new Set<string>();
  private stepUsages: StepUsage[] = [];
  private logger: Logger;

  // Current Anthropic pricing (as of latest update)
  private readonly PRICING = {
    input_tokens_per_1k: 0.00003,
    output_tokens_per_1k: 0.00015,
    cache_creation_per_1k: 0.000375,
    cache_read_per_1k: 0.0000075
  };

  constructor() {
    this.logger = new Logger('CostTracker');
  }

  processMessage(message: any): StepUsage | null {
    // Only process assistant messages with usage
    if (message.type !== 'assistant' || !message.usage) {
      return null;
    }

    // Skip if we've already processed this message ID
    if (this.processedMessageIds.has(message.id)) {
      return null;
    }

    // Mark as processed and record usage
    this.processedMessageIds.add(message.id);

    const stepUsage: StepUsage = {
      messageId: message.id,
      timestamp: new Date().toISOString(),
      usage: message.usage,
      costUSD: this.calculateCost(message.usage)
    };

    this.stepUsages.push(stepUsage);

    this.logger.debug(`Processed message ${message.id} - Cost: $${stepUsage.costUSD.toFixed(4)}`);

    return stepUsage;
  }

  calculateCost(usage: UsageData): number {
    const inputCost = (usage.input_tokens / 1000) * this.PRICING.input_tokens_per_1k;
    const outputCost = (usage.output_tokens / 1000) * this.PRICING.output_tokens_per_1k;
    const cacheCreationCost = ((usage.cache_creation_input_tokens || 0) / 1000) * this.PRICING.cache_creation_per_1k;
    const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1000) * this.PRICING.cache_read_per_1k;

    return inputCost + outputCost + cacheCreationCost + cacheReadCost;
  }

  aggregateUsage(current: UsageData, newUsage: UsageData): UsageData {
    return {
      input_tokens: (current.input_tokens || 0) + (newUsage.input_tokens || 0),
      output_tokens: (current.output_tokens || 0) + (newUsage.output_tokens || 0),
      cache_creation_input_tokens: (current.cache_creation_input_tokens || 0) + (newUsage.cache_creation_input_tokens || 0),
      cache_read_input_tokens: (current.cache_read_input_tokens || 0) + (newUsage.cache_read_input_tokens || 0),
      total_cost_usd: this.calculateCost({
        input_tokens: (current.input_tokens || 0) + (newUsage.input_tokens || 0),
        output_tokens: (current.output_tokens || 0) + (newUsage.output_tokens || 0),
        cache_creation_input_tokens: (current.cache_creation_input_tokens || 0) + (newUsage.cache_creation_input_tokens || 0),
        cache_read_input_tokens: (current.cache_read_input_tokens || 0) + (newUsage.cache_read_input_tokens || 0)
      })
    };
  }

  getTotalCost(): number {
    return this.stepUsages.reduce((total, step) => total + step.costUSD, 0);
  }

  getTotalUsage(): UsageData {
    return this.stepUsages.reduce((total: UsageData, step: StepUsage): UsageData => {
      return this.aggregateUsage(total, step.usage);
    }, {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      total_cost_usd: 0
    } as UsageData);
  }

  getStepBreakdown(): StepUsage[] {
    return [...this.stepUsages];
  }

  reset(): void {
    this.processedMessageIds.clear();
    this.stepUsages = [];
    this.logger.debug('Cost tracker reset');
  }

  generateReport(): string {
    const total = this.getTotalUsage();
    const totalCost = this.getTotalCost();

    return `
Cost Tracking Report
===================
Total Input Tokens: ${total.input_tokens.toLocaleString()}
Total Output Tokens: ${total.output_tokens.toLocaleString()}
Cache Creation Tokens: ${total.cache_creation_input_tokens?.toLocaleString() || 0}
Cache Read Tokens: ${total.cache_read_input_tokens?.toLocaleString() || 0}

Total Cost: $${totalCost.toFixed(4)}

Steps Processed: ${this.stepUsages.length}
Average Cost per Step: $${(totalCost / Math.max(this.stepUsages.length, 1)).toFixed(4)}
    `.trim();
  }
}