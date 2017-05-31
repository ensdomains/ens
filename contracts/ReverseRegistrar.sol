pragma solidity ^0.4.10;

import "./AbstractENS.sol";

contract Resolver {
    function setName(bytes32 node, string name) public;
}

/**
 * @dev Provides a default implementation of a resolver for reverse records,
 * which permits only the owner to update it.
 */
contract DefaultReverseResolver is Resolver {
    // namehash('addr.reverse')
    bytes32 constant ADDR_REVERSE_NODE = 0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2;

    AbstractENS public ens;
    mapping(bytes32=>string) public name;
    
    /**
     * @dev Constructor
     * @param ensAddr The address of the ENS registry.
     */
    function DefaultReverseResolver(AbstractENS ensAddr) {
        ens = ensAddr;

        // Assign ownership of the reverse record to our deployer
        var registrar = ReverseRegistrar(ens.owner(ADDR_REVERSE_NODE));
        if(address(registrar) != 0) {
            registrar.claim(msg.sender);
        }
    }

    /**
     * @dev Only permits calls by the reverse registrar.
     * @param node The node permission is required for.
     */
    modifier owner_only(bytes32 node) {
        require(msg.sender == ens.owner(node));
        _;
    }

    /**
     * @dev Sets the name for a node.
     * @param node The node to update.
     * @param _name The name to set.
     */
    function setName(bytes32 node, string _name) public owner_only(node) {
        name[node] = _name;
    }
}

contract ReverseRegistrar {
    // namehash('addr.reverse')
    bytes32 constant ADDR_REVERSE_NODE = 0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2;

    AbstractENS public ens;
    Resolver public defaultResolver;

    /**
     * @dev Constructor
     * @param ensAddr The address of the ENS registry.
     * @param resolverAddr The address of the default reverse resolver.
     */
    function ReverseRegistrar(AbstractENS ensAddr, Resolver resolverAddr) {
        ens = ensAddr;
        defaultResolver = resolverAddr;

        // Assign ownership of the reverse record to our deployer
        var oldRegistrar = ReverseRegistrar(ens.owner(ADDR_REVERSE_NODE));
        if(address(oldRegistrar) != 0) {
            oldRegistrar.claim(msg.sender);
        }
    }
    
    /**
     * @dev Transfers ownership of the reverse ENS record associated with the
     *      calling account.
     * @param owner The address to set as the owner of the reverse record in ENS.
     * @return The ENS node hash of the reverse record.
     */
    function claim(address owner) returns (bytes32 node) {
        return claimWithResolver(owner, 0);
    }

    /**
     * @dev Transfers ownership of the reverse ENS record associated with the
     *      calling account.
     * @param owner The address to set as the owner of the reverse record in ENS.
     * @param resolver The address of the resolver to set; 0 to leave unchanged.
     * @return The ENS node hash of the reverse record.
     */
    function claimWithResolver(address owner, address resolver) returns (bytes32 node) {
        var label = sha3HexAddress(msg.sender);
        node = sha3(ADDR_REVERSE_NODE, label);
        var currentOwner = ens.owner(node);

        // Update the resolver if required
        if(resolver != 0 && resolver != ens.resolver(node)) {
            // Transfer the name to us first if it's not already
            if(currentOwner != address(this)) {
                ens.setSubnodeOwner(ADDR_REVERSE_NODE, label, this);
                currentOwner = address(this);
            }
            ens.setResolver(node, resolver);
        }

        // Update the owner if required
        if(currentOwner != owner) {
            ens.setSubnodeOwner(ADDR_REVERSE_NODE, label, owner);
        }

        return node;
    }

    /**
     * @dev Sets the `name()` record for the reverse ENS record associated with
     * the calling account. First updates the resolver to the default reverse
     * resolver if necessary.
     * @param name The name to set for this address.
     * @return The ENS node hash of the reverse record.
     */
    function setName(string name) returns (bytes32 node) {
        node = claimWithResolver(this, defaultResolver);
        defaultResolver.setName(node, name);
        return node;
    }

    /**
     * @dev Returns the node hash for a given account's reverse records.
     * @param addr The address to hash
     * @return The ENS node hash.
     */
    function node(address addr) constant returns (bytes32 ret) {
        return sha3(ADDR_REVERSE_NODE, sha3HexAddress(addr));
    }

    /**
     * @dev An optimised function to compute the sha3 of the lower-case
     *      hexadecimal representation of an Ethereum address.
     * @param addr The address to hash
     * @return The SHA3 hash of the lower-case hexadecimal encoding of the
     *         input address.
     */
    function sha3HexAddress(address addr) private returns (bytes32 ret) {
        addr; ret; // Stop warning us about unused variables
        assembly {
            let lookup := 0x3031323334353637383961626364656600000000000000000000000000000000
            let i := 40
        loop:
            i := sub(i, 1)
            mstore8(i, byte(and(addr, 0xf), lookup))
            addr := div(addr, 0x10)
            i := sub(i, 1)
            mstore8(i, byte(and(addr, 0xf), lookup))
            addr := div(addr, 0x10)
            jumpi(loop, i)
            ret := sha3(0, 40)
        }
    }
}
