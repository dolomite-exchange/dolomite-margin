pragma solidity ^0.8.0;

import { IKeyringChecker } from "../interfaces/IKeyringChecker.sol";
import { Require } from "../../protocol/lib/Require.sol";


/**
 * @title OnlyDolomiteMargin
 * @author Dolomite
 *
 * Inheritable contract that restricts the calling of certain functions to DolomiteMargin only
 */
contract OnlyKeyringWhiteListed {

    // ============ Constants ============

    bytes32 private constant FILE = "OnlyKeyringWhiteListed";

    // ============ Storage ============

    IKeyringChecker public KEYRING_CHECKER;

    // ============ Constructor ============

    constructor (
        address _keyringChecker
    )
        public
    {
        KEYRING_CHECKER = IKeyringChecker(_keyringChecker);
    }

    // ============ Modifiers ============

    modifier onlyKeyringWhiteListed() {
        Require.that(
            KEYRING_CHECKER.checkCredential(POLICY_ID, msg.sender),
            FILE,
            "Only whitelisted can call function"
        );
        _;
    }

}
