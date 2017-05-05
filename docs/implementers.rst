*******************
Implementer's Guide
*******************

This section is intended to provide guidance for anyone wanting to implement tools and applications that use ENS, or custom resolvers within ENS.

Writing a resolver
==================

Resolvers are specified in EIP137_. A resolver must implement the following method:

::

    function supportsInterface(bytes4 interfaceID) constant returns (bool)

`supportsInterface` is defined in EIP165_, and allows callers to determine if a resolver supports a particular record type. Record types are specified as a set of one or more methods that a resolver must implement together. Currently defined record types include:

+------------------+-------------+--------------+------------+
| Record type      | Function(s) | Interface ID | Defined in |
+==================+=============+==============+============+
| Ethereum address | `addr`      | 0x3b3b57de   | EIP137_    |
+------------------+-------------+--------------+------------+
| ENS Name         | `name`      | 0x691f3431   | EIP181_    |
+------------------+-------------+--------------+------------+
| ABI specification| `ABI`       | 0x2203ab56   | EIP205_    |
+------------------+-------------+--------------+------------+
| Public key       | `pubkey`    | 0xc8690233   | EIP619_    |
+------------------+-------------+--------------+------------+

`supportsInterface` must also return true for the `interfaceID` value `0x01ffc9a7`, which is the interface ID of `supportsInterface` itself.

Additionally, the `content()` interface is currently used as a defacto standard for Swarm hashes, pending standardisation, and has an interface ID of `0xd8389dc5`.

For example, a simple resolver that supports only the `addr` type might look something like this:

::

    contract SimpleResolver {
        function supportsInterface(bytes4 interfaceID) constant returns (bool) {
            return interfaceID == 0x3b3b57de;
        }

        function addr(bytes32 nodeID) constant returns (address) {
            return address(this);
        }
    }

This trivial resolver always returns its own address as answer to all queries. Practical resolvers may use any mechanism they wish to determine what results to return, though they should be `constant`, and should minimise gas usage wherever possible.

Resolving names onchain
=======================

Solidity libraries for onchain resolution are not yet available, but ENS resolution is straightforward enough it can be done trivially without a library. Contracts may use the following interfaces:

::

    contract ENS {
        function owner(bytes32 node) constant returns (address);
        function resolver(bytes32 node) constant returns (Resolver);
        function ttl(bytes32 node) constant returns (uint64);
        function setOwner(bytes32 node, address owner);
        function setSubnodeOwner(bytes32 node, bytes32 label, address owner);
        function setResolver(bytes32 node, address resolver);
        function setTTL(bytes32 node, uint64 ttl);
    }

    contract Resolver {
        function addr(bytes32 node) constant returns (address);
    }

For resolution, only the `resolver()` function in the ENS contract is required; other methods permit looking up owners, and updating ENS from within a contract that owns a name.

With these definitions, looking up a name given its node hash is straightforward:

::

    contract MyContract {
        ENS ens;

        function MyContract(address ensAddress) {
            ens = ENS(ensAddress);
        }

        function resolve(bytes32 node) constant returns(address) {
            var resolver = ens.resolver(node)
            return resolver.addr(node);
        }
    }

While it is possible for a contract to process a human-readable name into a node hash, we highly recommend working with node hashes instead, as they are easier to work with, and allow contracts to leave the complex work of normalising the name to their callers outside the blockchain. Where a contract always resolves the same names, those names may be converted to a node hash and stored in the contract as a constant.

Writing a registrar
===================

A registrar in ENS is simply any contract that owns a name, and allocates subdomains of it according to some set of rules defined in the contract code. A trivial first in first served contract is demonstrated below, using the ENS interface definition defined earlier.

::

    contract FIFSRegistrar {
        ENS ens;
        bytes32 rootNode;

        function FIFSRegistrar(address ensAddr, bytes32 node) {
            ens = ENS(ensAddr);
            rootNode = node;
        }

        function register(bytes32 subnode, address owner) {
            var node = sha3(rootNode, subnode);
            var currentOwner = ens.owner(node);
            if(currentOwner != 0 && currentOwner != msg.sender)
                throw;

            ens.setSubnodeOwner(rootNode, subnode, owner);
        }
    }

Interacting with ENS offchain
=============================

A Javascript library, ethereum-ens_, is available to facilitate reading and writing ENS from offchain. This section will be updated as libraries for more languages become available.

Normalising and validating names
================================

Before a name can be converted to a node hash using :ref:`namehash`, the name must first be normalised and checked for validity - for instance, converting `fOO.eth` into `foo.eth`, and prohibiting names containing forbidden characters such as underscores. It is crucial that all applications follow the same set of rules for normalisation and validation, as otherwise two users entering the same name on different systems may resolve the same human-readable name into two different ENS names.

Applications using ENS and processing human-readable names must follow UTS46_ for normalisation and validation. Processing should be done with non-transitional rules, and with `UseSTD3ASCIIRules=true`.

The ethereum-ens_ Javascript library incorporates compliant preprocessing into its `validate` and `namehash` functions, so users of this library avoid the need to handle this manually.

Handling of ambiguous names
===========================

Because of the large number of characters in unicode, and the wide variety of scripts represented, inevitably there are different Unicode characters that are similar or even identical when shown in common fonts. This can be abused to trick users into thinking they are visiting one site or resource, when in fact they are visiting another. This is known as a `homoglyph attack`_.

User agents and other software that display names to users should take countermeasures against these attacks, such as by highlighting problematic characters, or showing warnings to users about mixed scripts. `Chromium's IDNA strategy`_ may serve as a useful reference for user-agent behaviour around rendering IDNA names.

.. _EIP137: https://github.com/ethereum/EIPs/issues/137
.. _EIP165: https://github.com/ethereum/EIPs/issues/165
.. _EIP181: https://github.com/ethereum/EIPs/issues/181
.. _EIP205: https://github.com/ethereum/EIPs/pull/205
.. _EIP619: https://github.com/ethereum/EIPs/pull/619
.. _ethereum-ens: https://www.npmjs.com/package/ethereum-ens
.. _UTS46: http://unicode.org/reports/tr46/
.. _`homoglyph attack`: https://en.wikipedia.org/wiki/Internationalized_domain_name#ASCII_spoofing_concerns
.. _`Chromium's IDNA strategy`: https://www.chromium.org/developers/design-documents/idn-in-google-chrome
