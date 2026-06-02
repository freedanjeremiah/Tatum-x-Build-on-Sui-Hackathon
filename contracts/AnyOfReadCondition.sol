// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IReadCondition} from "./IReadCondition.sol";

/// @title AnyOfReadCondition — composable OR over CDR read conditions
/// @notice The vault unlocks if ANY sub-condition passes. This makes CDR
/// conditions composable: a single vault gate can be "license OR token-balance OR
/// merkle-allowlist" by listing each sub-condition contract + its data.
/// `accessAuxData` is forwarded unchanged to every sub-condition.
///
/// readConditionData = abi.encode(address[] conditions, bytes[] datas)
contract AnyOfReadCondition is IReadCondition {
    function checkReadCondition(
        uint32 label,
        bytes calldata accessAuxData,
        bytes calldata readConditionData,
        address caller
    ) external view returns (bool) {
        (address[] memory conds, bytes[] memory datas) =
            abi.decode(readConditionData, (address[], bytes[]));
        require(conds.length == datas.length, "AnyOf: length mismatch");

        for (uint256 i; i < conds.length; ++i) {
            (bool ok, bytes memory ret) = conds[i].staticcall(
                abi.encodeWithSelector(
                    IReadCondition.checkReadCondition.selector,
                    label,
                    accessAuxData,
                    datas[i],
                    caller
                )
            );
            if (ok && ret.length == 32 && abi.decode(ret, (bool))) {
                return true;
            }
        }
        return false;
    }
}
