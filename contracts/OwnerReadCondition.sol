// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IReadCondition} from "./IReadCondition.sol";

/// @title OwnerReadCondition — owner-only vault decryption
/// @notice Resolves the private-tier vault read path. The deployed
/// `OWNER_WRITE_CONDITION` only implements `checkWriteCondition` — it cannot
/// gate a READ because the CDR precompile staticcalls `checkReadCondition` and
/// that function does not exist on the write-only contract. Without this, every
/// private-tier `download()` reverts at the precompile.
///
/// This contract is the read-side counterpart: it gates a read on whether the
/// caller is the owner address encoded in `readConditionData`. Identical shape
/// to `ComputeWorkerReadCondition`, just a single owner instead of an
/// allowlist.
///
/// readConditionData = abi.encode(address owner)
contract OwnerReadCondition is IReadCondition {
    function checkReadCondition(
        uint32, /* label */
        bytes calldata, /* accessAuxData */
        bytes calldata readConditionData,
        address caller
    ) external pure returns (bool) {
        address owner = abi.decode(readConditionData, (address));
        return owner == caller;
    }
}
