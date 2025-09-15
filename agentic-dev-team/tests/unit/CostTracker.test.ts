import { CostTracker } from '../../src/utils/CostTracker.js';

describe('CostTracker', () => {
  let costTracker: CostTracker;

  beforeEach(() => {
    costTracker = new CostTracker();
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for basic usage', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0
      };

      const cost = costTracker.calculateCost(usage);
      const expectedCost = (1000 / 1000) * 0.00003 + (500 / 1000) * 0.00015;

      expect(cost).toBeCloseTo(expectedCost, 6);
    });

    it('should include cache costs when present', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 100
      };

      const cost = costTracker.calculateCost(usage);
      const expectedCost =
        (1000 / 1000) * 0.00003 +  // input
        (500 / 1000) * 0.00015 +   // output
        (200 / 1000) * 0.000375 +  // cache creation
        (100 / 1000) * 0.0000075;  // cache read

      expect(cost).toBeCloseTo(expectedCost, 6);
    });
  });

  describe('processMessage', () => {
    it('should process assistant messages with usage', () => {
      const message = {
        type: 'assistant',
        id: 'msg_123',
        usage: global.testUtils.createMockUsageData()
      };

      const result = costTracker.processMessage(message);

      expect(result).toBeTruthy();
      expect(result!.messageId).toBe('msg_123');
      expect(result!.costUSD).toBeGreaterThan(0);
    });

    it('should ignore non-assistant messages', () => {
      const message = {
        type: 'user',
        id: 'msg_456',
        content: 'Hello'
      };

      const result = costTracker.processMessage(message);
      expect(result).toBeNull();
    });

    it('should ignore duplicate message IDs', () => {
      const message = {
        type: 'assistant',
        id: 'msg_123',
        usage: global.testUtils.createMockUsageData()
      };

      // Process same message twice
      const result1 = costTracker.processMessage(message);
      const result2 = costTracker.processMessage(message);

      expect(result1).toBeTruthy();
      expect(result2).toBeNull();
    });
  });

  describe('aggregateUsage', () => {
    it('should correctly aggregate usage data', () => {
      const usage1 = {
        input_tokens: 100,
        output_tokens: 200,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 25
      };

      const usage2 = {
        input_tokens: 150,
        output_tokens: 300,
        cache_creation_input_tokens: 75,
        cache_read_input_tokens: 35
      };

      const aggregated = costTracker.aggregateUsage(usage1, usage2);

      expect(aggregated.input_tokens).toBe(250);
      expect(aggregated.output_tokens).toBe(500);
      expect(aggregated.cache_creation_input_tokens).toBe(125);
      expect(aggregated.cache_read_input_tokens).toBe(60);
      expect(aggregated.total_cost_usd).toBeGreaterThan(0);
    });
  });

  describe('generateReport', () => {
    it('should generate a comprehensive report', () => {
      // Add some test data
      const message1 = {
        type: 'assistant',
        id: 'msg_1',
        usage: { input_tokens: 100, output_tokens: 200 }
      };

      const message2 = {
        type: 'assistant',
        id: 'msg_2',
        usage: { input_tokens: 150, output_tokens: 300 }
      };

      costTracker.processMessage(message1);
      costTracker.processMessage(message2);

      const report = costTracker.generateReport();

      expect(report).toContain('Cost Tracking Report');
      expect(report).toContain('Total Input Tokens: 250');
      expect(report).toContain('Total Output Tokens: 500');
      expect(report).toContain('Steps Processed: 2');
    });
  });
});