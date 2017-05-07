pragma solidity ^0.4.0;

import './AbstractENS.sol';

/**
 * A registrar that allocates subdomains to the first person to claim them, but
 * expires registrations a fixed period after they're initially claimed.
 */
contract TestRegistrar {
    uint constant registrationPeriod = 4 weeks;

    AbstractENS public ens;
    bytes32 public rootNode;
    mapping(bytes32=>uint) public expiryTimes;

    /**
     * Constructor.
     * @param ensAddr The address of the ENS registry.
     * @param node The node that this registrar administers.
     */
    function TestRegistrar(AbstractENS ensAddr, bytes32 node) {
        ens = ensAddr;
        rootNode = node;
    }

    /**
     * Register a name that's not currently registered
     * @param subnode The hash of the label to register.
     * @param owner The address of the new owner.
     */
    function register(bytes32 subnode, address owner) {
        if (expiryTimes[subnode] >= now) throw;

        expiryTimes[subnode] = now + registrationPeriod;
        ens.setSubnodeOwner(rootNode, subnode, owner);
    }
}
