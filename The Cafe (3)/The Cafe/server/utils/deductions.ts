/**
 * Philippine Payroll Deduction Calculations
 * Based on 2024 contribution tables for SSS, PhilHealth, Pag-IBIG, and BIR
 * Now uses database-configurable rates for admin flexibility
 */

import { dbStorage } from '../db-storage';

export interface DeductionBreakdown {
  sssContribution: number;
  philHealthContribution: number;
  pagibigContribution: number;
  withholdingTax: number;
}

/**
 * Calculate SSS contribution (employee share)
 * Based on SSS contribution table from database
 */
export async function calculateSSS(monthlyBasicSalary: number): Promise<number> {
  try {
    const sssRates = await dbStorage.getDeductionRatesByType('sss');

    // Filter only active rates and sort by min salary
    const activeRates = sssRates
      .filter(rate => rate.isActive)
      .sort((a, b) => parseFloat(a.minSalary) - parseFloat(b.minSalary));

    for (const bracket of activeRates) {
      const min = parseFloat(bracket.minSalary);
      const max = bracket.maxSalary ? parseFloat(bracket.maxSalary) : Infinity;

      if (monthlyBasicSalary >= min && monthlyBasicSalary <= max) {
        // Return fixed contribution amount
        return bracket.employeeContribution ? parseFloat(bracket.employeeContribution) : 0;
      }
    }

    return 0;
  } catch (error) {
    console.error('Error calculating SSS:', error);
    return 0;
  }
}

/**
 * Calculate PhilHealth contribution (employee share)
 * Based on PhilHealth contribution table from database
 */
export async function calculatePhilHealth(monthlyBasicSalary: number): Promise<number> {
  try {
    const philHealthRates = await dbStorage.getDeductionRatesByType('philhealth');

    // Get the active rate (should be only one)
    const activeRate = philHealthRates.find(rate => rate.isActive);

    if (!activeRate) return 0;

    const minSalary = parseFloat(activeRate.minSalary);
    const maxSalary = activeRate.maxSalary ? parseFloat(activeRate.maxSalary) : Infinity;
    const employeeRate = activeRate.employeeRate ? parseFloat(activeRate.employeeRate) / 100 : 0;

    let baseSalary = monthlyBasicSalary;

    // Apply floor and ceiling
    if (baseSalary < minSalary) baseSalary = minSalary;
    if (baseSalary > maxSalary) baseSalary = maxSalary;

    const employeeContribution = baseSalary * employeeRate;

    return Math.round(employeeContribution * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Error calculating PhilHealth:', error);
    return 0;
  }
}

/**
 * Calculate Pag-IBIG contribution (employee share)
 * Based on Pag-IBIG (HDMF) contribution table from database
 */
export async function calculatePagibig(monthlyBasicSalary: number): Promise<number> {
  try {
    const pagibigRates = await dbStorage.getDeductionRatesByType('pagibig');

    // Filter active rates and sort by min salary
    const activeRates = pagibigRates
      .filter(rate => rate.isActive)
      .sort((a, b) => parseFloat(a.minSalary) - parseFloat(b.minSalary));

    for (const bracket of activeRates) {
      const min = parseFloat(bracket.minSalary);
      const max = bracket.maxSalary ? parseFloat(bracket.maxSalary) : Infinity;

      if (monthlyBasicSalary >= min && monthlyBasicSalary <= max) {
        const rate = bracket.employeeRate ? parseFloat(bracket.employeeRate) / 100 : 0;
        const contribution = monthlyBasicSalary * rate;

        // Maximum employee contribution is ₱100
        return Math.min(contribution, 100);
      }
    }

    return 0;
  } catch (error) {
    console.error('Error calculating Pag-IBIG:', error);
    return 0;
  }
}

/**
 * Calculate withholding tax based on BIR tax table from database
 * Using the TRAIN law tax brackets
 */
export async function calculateWithholdingTax(monthlyBasicSalary: number): Promise<number> {
  try {
    const taxRates = await dbStorage.getDeductionRatesByType('tax');

    // Filter active rates and sort by min salary
    const activeRates = taxRates
      .filter(rate => rate.isActive)
      .sort((a, b) => parseFloat(a.minSalary) - parseFloat(b.minSalary));

    if (activeRates.length === 0) return 0;

    // Convert monthly to annual salary
    const annualSalary = monthlyBasicSalary * 12;

    let annualTax = 0;

    // Find the applicable tax bracket
    for (let i = 0; i < activeRates.length; i++) {
      const bracket = activeRates[i];
      const min = parseFloat(bracket.minSalary);
      const max = bracket.maxSalary ? parseFloat(bracket.maxSalary) : Infinity;
      const rate = bracket.employeeRate ? parseFloat(bracket.employeeRate) / 100 : 0;

      if (annualSalary >= min && annualSalary <= max) {
        // Calculate tax based on bracket
        if (i === 0) {
          // First bracket (tax-exempt)
          annualTax = 0;
        } else if (i === 1) {
          // Second bracket: 15% on excess over 250,000
          annualTax = (annualSalary - 250000) * rate;
        } else if (i === 2) {
          // Third bracket: 22,500 + 20% on excess over 400,000
          annualTax = 22500 + (annualSalary - 400000) * rate;
        } else if (i === 3) {
          // Fourth bracket: 102,500 + 25% on excess over 800,000
          annualTax = 102500 + (annualSalary - 800000) * rate;
        } else if (i === 4) {
          // Fifth bracket: 402,500 + 30% on excess over 2,000,000
          annualTax = 402500 + (annualSalary - 2000000) * rate;
        } else if (i === 5) {
          // Sixth bracket: 2,202,500 + 35% on excess over 8,000,000
          annualTax = 2202500 + (annualSalary - 8000000) * rate;
        }
        break;
      }
    }

    // Convert to monthly
    const monthlyTax = annualTax / 12;

    return Math.round(monthlyTax * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Error calculating withholding tax:', error);
    return 0;
  }
}

/**
 * Calculate all deductions based on monthly basic salary
 */
export async function calculateAllDeductions(
  monthlyBasicSalary: number,
  settings: {
    deductSSS: boolean;
    deductPhilHealth: boolean;
    deductPagibig: boolean;
    deductWithholdingTax: boolean;
  }
): Promise<DeductionBreakdown> {
  const [sss, philHealth, pagibig, tax] = await Promise.all([
    settings.deductSSS ? calculateSSS(monthlyBasicSalary) : Promise.resolve(0),
    settings.deductPhilHealth ? calculatePhilHealth(monthlyBasicSalary) : Promise.resolve(0),
    settings.deductPagibig ? calculatePagibig(monthlyBasicSalary) : Promise.resolve(0),
    settings.deductWithholdingTax ? calculateWithholdingTax(monthlyBasicSalary) : Promise.resolve(0),
  ]);

  return {
    sssContribution: sss,
    philHealthContribution: philHealth,
    pagibigContribution: pagibig,
    withholdingTax: tax,
  };
}
