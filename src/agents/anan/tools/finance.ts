export interface LoanEstimateInput {
  salary: number;
  annualRatePercent: number;
  years: number;
  downPayment?: number;
}

export interface LoanEstimateResult {
  monthlyInstallment: number;
  totalCost: number;
}

export function calculateLoanEstimate(input: LoanEstimateInput): LoanEstimateResult {
  const principal = Math.max(0, input.salary * 60 - (input.downPayment ?? 0));
  const months = Math.max(1, input.years * 12);
  const monthlyRate = input.annualRatePercent / 12 / 100;
  if (monthlyRate <= 0) {
    return {
      monthlyInstallment: Number((principal / months).toFixed(2)),
      totalCost: Number(principal.toFixed(2)),
    };
  }
  const factor = Math.pow(1 + monthlyRate, months);
  const installment = (principal * monthlyRate * factor) / (factor - 1);
  return {
    monthlyInstallment: Number(installment.toFixed(2)),
    totalCost: Number((installment * months).toFixed(2)),
  };
}
