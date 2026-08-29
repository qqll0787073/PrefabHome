import assert from "node:assert/strict";
import test from "node:test";
import { resolveRoutedContractSelection, type ContractSelectionSource } from "./buyerContractSelectionModel";

const contractA = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Contract A" };
const contractB = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", label: "Contract B" };
const unavailableId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("routed Contract selection follows authorized loaded records and clears stale detail", () => {
  const contracts = [contractA, contractB];
  const selectedA = resolveRoutedContractSelection(contractA.id, contracts, null, false);
  assert.deepEqual(selectedA, { kind: "select", contract: contractA });

  const unavailable = resolveRoutedContractSelection(unavailableId, contracts, "route", false);
  assert.deepEqual(unavailable, { kind: "clear" });
  assert.doesNotMatch(JSON.stringify(unavailable), /Contract A|Contract C/);

  const selectedB = resolveRoutedContractSelection(contractB.id, contracts, "route", false);
  assert.deepEqual(selectedB, { kind: "select", contract: contractB });

  assert.deepEqual(resolveRoutedContractSelection(null, contracts, "route", false), { kind: "clear" });
});

test("manual selection is preserved without a routed record", () => {
  const source: ContractSelectionSource = "manual";
  assert.deepEqual(resolveRoutedContractSelection(null, [contractA], source, false), { kind: "preserve" });
  assert.deepEqual(resolveRoutedContractSelection(contractB.id, [contractA], source, false), { kind: "clear" });
});
