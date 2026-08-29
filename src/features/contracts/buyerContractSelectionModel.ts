export type ContractSelectionSource = "manual" | "route" | null;

export type RoutedContractSelection<T> =
  | { kind: "preserve" }
  | { kind: "clear" }
  | { kind: "select"; contract: T };

export function resolveRoutedContractSelection<T extends { id: string }>(
  selectedContractId: string | null,
  contracts: readonly T[],
  currentSource: ContractSelectionSource,
  isLoading: boolean
): RoutedContractSelection<T> {
  if (isLoading) return { kind: "preserve" };
  if (selectedContractId) {
    const routedContract = contracts.find((contract) => contract.id === selectedContractId);
    return routedContract ? { kind: "select", contract: routedContract } : { kind: "clear" };
  }
  return currentSource === "route" ? { kind: "clear" } : { kind: "preserve" };
}
