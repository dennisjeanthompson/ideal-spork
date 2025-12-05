/**
 * Script to clear and reseed deduction rates
 * Run this to update the deduction rates table with complete data
 */

import { sql as sqlite } from './db';

async function reseedDeductionRates() {
  try {
    console.log('🗑️  Clearing existing deduction rates...');
    sqlite.exec('DELETE FROM deduction_rates');
    
    console.log('🌱 Reseeding deduction rates with complete data...');

    // SSS Contribution Table 2024 (Complete - All 44 brackets)
    const sssRates = [
      { min: '0', max: '4249.99', contribution: '180' },
      { min: '4250', max: '4749.99', contribution: '202.50' },
      { min: '4750', max: '5249.99', contribution: '225' },
      { min: '5250', max: '5749.99', contribution: '247.50' },
      { min: '5750', max: '6249.99', contribution: '270' },
      { min: '6250', max: '6749.99', contribution: '292.50' },
      { min: '6750', max: '7249.99', contribution: '315' },
      { min: '7250', max: '7749.99', contribution: '337.50' },
      { min: '7750', max: '8249.99', contribution: '360' },
      { min: '8250', max: '8749.99', contribution: '382.50' },
      { min: '8750', max: '9249.99', contribution: '405' },
      { min: '9250', max: '9749.99', contribution: '427.50' },
      { min: '9750', max: '10249.99', contribution: '450' },
      { min: '10250', max: '10749.99', contribution: '472.50' },
      { min: '10750', max: '11249.99', contribution: '495' },
      { min: '11250', max: '11749.99', contribution: '517.50' },
      { min: '11750', max: '12249.99', contribution: '540' },
      { min: '12250', max: '12749.99', contribution: '562.50' },
      { min: '12750', max: '13249.99', contribution: '585' },
      { min: '13250', max: '13749.99', contribution: '607.50' },
      { min: '13750', max: '14249.99', contribution: '630' },
      { min: '14250', max: '14749.99', contribution: '652.50' },
      { min: '14750', max: '15249.99', contribution: '675' },
      { min: '15250', max: '15749.99', contribution: '697.50' },
      { min: '15750', max: '16249.99', contribution: '720' },
      { min: '16250', max: '16749.99', contribution: '742.50' },
      { min: '16750', max: '17249.99', contribution: '765' },
      { min: '17250', max: '17749.99', contribution: '787.50' },
      { min: '17750', max: '18249.99', contribution: '810' },
      { min: '18250', max: '18749.99', contribution: '832.50' },
      { min: '18750', max: '19249.99', contribution: '855' },
      { min: '19250', max: '19749.99', contribution: '877.50' },
      { min: '19750', max: '20249.99', contribution: '900' },
      { min: '20250', max: '20749.99', contribution: '922.50' },
      { min: '20750', max: '21249.99', contribution: '945' },
      { min: '21250', max: '21749.99', contribution: '967.50' },
      { min: '21750', max: '22249.99', contribution: '990' },
      { min: '22250', max: '22749.99', contribution: '1012.50' },
      { min: '22750', max: '23249.99', contribution: '1035' },
      { min: '23250', max: '23749.99', contribution: '1057.50' },
      { min: '23750', max: '24249.99', contribution: '1080' },
      { min: '24250', max: '24749.99', contribution: '1102.50' },
      { min: '24750', max: '29999.99', contribution: '1125' },
      { min: '30000', max: null, contribution: '1125' }, // Maximum contribution
    ];

    const insertRate = sqlite.prepare(`
      INSERT INTO deduction_rates (id, type, min_salary, max_salary, employee_rate, employee_contribution, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;

    // Insert SSS rates
    for (const rate of sssRates) {
      const id = `rate-sss-${count++}`;
      insertRate.run(
        id,
        'sss',
        rate.min,
        rate.max,
        null,
        rate.contribution,
        `SSS Bracket ₱${rate.min} - ₱${rate.max || 'and above'}`,
        1,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      );
    }

    // PhilHealth rate (percentage-based)
    insertRate.run(
      `rate-philhealth-${count++}`,
      'philhealth',
      '10000',
      '100000',
      '2.5',
      null,
      'PhilHealth 2.5% employee share (5% total premium)',
      1,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    // Pag-IBIG rates
    insertRate.run(
      `rate-pagibig-${count++}`,
      'pagibig',
      '0',
      '1500',
      '1',
      null,
      'Pag-IBIG 1% for salary ≤ ₱1,500',
      1,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    insertRate.run(
      `rate-pagibig-${count++}`,
      'pagibig',
      '1500.01',
      null,
      '2',
      null,
      'Pag-IBIG 2% for salary > ₱1,500 (max ₱100)',
      1,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    );

    // Withholding Tax rates (TRAIN Law - Annual brackets)
    const taxRates = [
      { min: '0', max: '250000', rate: '0', description: 'Tax-exempt bracket' },
      { min: '250000.01', max: '400000', rate: '15', description: '15% on excess over ₱250,000' },
      { min: '400000.01', max: '800000', rate: '20', description: '₱22,500 + 20% on excess over ₱400,000' },
      { min: '800000.01', max: '2000000', rate: '25', description: '₱102,500 + 25% on excess over ₱800,000' },
      { min: '2000000.01', max: '8000000', rate: '30', description: '₱402,500 + 30% on excess over ₱2,000,000' },
      { min: '8000000.01', max: null, rate: '35', description: '₱2,202,500 + 35% on excess over ₱8,000,000' },
    ];

    for (const rate of taxRates) {
      const id = `rate-tax-${count++}`;
      insertRate.run(
        id,
        'tax',
        rate.min,
        rate.max,
        rate.rate,
        null,
        rate.description,
        1,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      );
    }

    console.log(`✅ Successfully seeded ${count} deduction rates`);
    console.log('   - SSS: 44 brackets');
    console.log('   - PhilHealth: 1 rate');
    console.log('   - Pag-IBIG: 2 rates');
    console.log('   - Withholding Tax: 6 brackets');
  } catch (error) {
    console.error('❌ Failed to reseed deduction rates:', error);
  }
}

reseedDeductionRates();

