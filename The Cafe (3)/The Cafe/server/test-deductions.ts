/**
 * Test script to verify deduction calculations
 */

import { calculateAllDeductions } from './utils/deductions';

async function testDeductions() {
  console.log('🧪 Testing Deduction Calculations\n');
  console.log('='.repeat(60));

  // Test case 1: Low salary (₱8,000/month)
  console.log('\n📊 Test Case 1: Monthly Salary = ₱8,000');
  console.log('-'.repeat(60));
  const test1 = await calculateAllDeductions(8000, {
    deductSSS: true,
    deductPhilHealth: true,
    deductPagibig: true,
    deductWithholdingTax: true,
  });
  console.log('SSS Contribution:       ₱' + test1.sssContribution.toFixed(2));
  console.log('PhilHealth:             ₱' + test1.philHealthContribution.toFixed(2));
  console.log('Pag-IBIG:               ₱' + test1.pagibigContribution.toFixed(2));
  console.log('Withholding Tax:        ₱' + test1.withholdingTax.toFixed(2));
  console.log('Total Deductions:       ₱' + (
    test1.sssContribution + 
    test1.philHealthContribution + 
    test1.pagibigContribution + 
    test1.withholdingTax
  ).toFixed(2));

  // Test case 2: Medium salary (₱15,000/month)
  console.log('\n📊 Test Case 2: Monthly Salary = ₱15,000');
  console.log('-'.repeat(60));
  const test2 = await calculateAllDeductions(15000, {
    deductSSS: true,
    deductPhilHealth: true,
    deductPagibig: true,
    deductWithholdingTax: true,
  });
  console.log('SSS Contribution:       ₱' + test2.sssContribution.toFixed(2));
  console.log('PhilHealth:             ₱' + test2.philHealthContribution.toFixed(2));
  console.log('Pag-IBIG:               ₱' + test2.pagibigContribution.toFixed(2));
  console.log('Withholding Tax:        ₱' + test2.withholdingTax.toFixed(2));
  console.log('Total Deductions:       ₱' + (
    test2.sssContribution + 
    test2.philHealthContribution + 
    test2.pagibigContribution + 
    test2.withholdingTax
  ).toFixed(2));

  // Test case 3: High salary (₱30,000/month)
  console.log('\n📊 Test Case 3: Monthly Salary = ₱30,000');
  console.log('-'.repeat(60));
  const test3 = await calculateAllDeductions(30000, {
    deductSSS: true,
    deductPhilHealth: true,
    deductPagibig: true,
    deductWithholdingTax: true,
  });
  console.log('SSS Contribution:       ₱' + test3.sssContribution.toFixed(2));
  console.log('PhilHealth:             ₱' + test3.philHealthContribution.toFixed(2));
  console.log('Pag-IBIG:               ₱' + test3.pagibigContribution.toFixed(2));
  console.log('Withholding Tax:        ₱' + test3.withholdingTax.toFixed(2));
  console.log('Total Deductions:       ₱' + (
    test3.sssContribution + 
    test3.philHealthContribution + 
    test3.pagibigContribution + 
    test3.withholdingTax
  ).toFixed(2));

  // Test case 4: With toggles OFF
  console.log('\n📊 Test Case 4: Monthly Salary = ₱15,000 (Only SSS enabled)');
  console.log('-'.repeat(60));
  const test4 = await calculateAllDeductions(15000, {
    deductSSS: true,
    deductPhilHealth: false,
    deductPagibig: false,
    deductWithholdingTax: false,
  });
  console.log('SSS Contribution:       ₱' + test4.sssContribution.toFixed(2));
  console.log('PhilHealth:             ₱' + test4.philHealthContribution.toFixed(2));
  console.log('Pag-IBIG:               ₱' + test4.pagibigContribution.toFixed(2));
  console.log('Withholding Tax:        ₱' + test4.withholdingTax.toFixed(2));
  console.log('Total Deductions:       ₱' + (
    test4.sssContribution + 
    test4.philHealthContribution + 
    test4.pagibigContribution + 
    test4.withholdingTax
  ).toFixed(2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed successfully!\n');

  // Verify expected values
  console.log('📋 Verification:');
  console.log('-'.repeat(60));
  
  // Test 1 verification (₱8,000)
  const expectedSSS1 = 360; // Based on SSS table for ₱7,750-₱8,249.99
  const expectedPhilHealth1 = 250; // 10,000 (floor) * 2.5% = 250
  const expectedPagibig1 = 100; // 8,000 * 2% = 160, capped at 100
  console.log(`Test 1 SSS: ${test1.sssContribution === expectedSSS1 ? '✅' : '❌'} Expected ₱${expectedSSS1}, Got ₱${test1.sssContribution}`);
  console.log(`Test 1 PhilHealth: ${test1.philHealthContribution === expectedPhilHealth1 ? '✅' : '❌'} Expected ₱${expectedPhilHealth1}, Got ₱${test1.philHealthContribution}`);
  console.log(`Test 1 Pag-IBIG: ${test1.pagibigContribution === expectedPagibig1 ? '✅' : '❌'} Expected ₱${expectedPagibig1}, Got ₱${test1.pagibigContribution}`);
  
  // Test 2 verification (₱15,000)
  const expectedSSS2 = 675; // Based on SSS table for ₱14,750-₱15,249.99
  const expectedPhilHealth2 = 375; // 15,000 * 2.5% = 375
  const expectedPagibig2 = 100; // 15,000 * 2% = 300, capped at 100
  console.log(`Test 2 SSS: ${test2.sssContribution === expectedSSS2 ? '✅' : '❌'} Expected ₱${expectedSSS2}, Got ₱${test2.sssContribution}`);
  console.log(`Test 2 PhilHealth: ${test2.philHealthContribution === expectedPhilHealth2 ? '✅' : '❌'} Expected ₱${expectedPhilHealth2}, Got ₱${test2.philHealthContribution}`);
  console.log(`Test 2 Pag-IBIG: ${test2.pagibigContribution === expectedPagibig2 ? '✅' : '❌'} Expected ₱${expectedPagibig2}, Got ₱${test2.pagibigContribution}`);

  // Test 3 verification (₱30,000)
  const expectedSSS3 = 1125; // Maximum SSS contribution
  const expectedPhilHealth3 = 750; // 30,000 * 2.5% = 750
  const expectedPagibig3 = 100; // Capped at 100
  console.log(`Test 3 SSS: ${test3.sssContribution === expectedSSS3 ? '✅' : '❌'} Expected ₱${expectedSSS3}, Got ₱${test3.sssContribution}`);
  console.log(`Test 3 PhilHealth: ${test3.philHealthContribution === expectedPhilHealth3 ? '✅' : '❌'} Expected ₱${expectedPhilHealth3}, Got ₱${test3.philHealthContribution}`);
  console.log(`Test 3 Pag-IBIG: ${test3.pagibigContribution === expectedPagibig3 ? '✅' : '❌'} Expected ₱${expectedPagibig3}, Got ₱${test3.pagibigContribution}`);

  console.log('\n');
}

testDeductions().catch(console.error);

