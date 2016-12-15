***********************************
Interacting with the ENS registry
***********************************

The ENS registry forms the central component of ENS, mapping from hashed names to resolvers, as well as the owners of the names and their TTL (caching time-to-live).

Before you can make any changes to the ENS registry, you need to control an account that has ownership of a name in ENS. To obtain an ENS name on the Ropsten testnet, see `registering a name with the auction registrar`_ for '.eth', or `registering a name with the test registrar`_ for '.test'. Names on '.test' are temporary, and can be claimed by someone else 28 days later.

Alternately, you can obtain a subdomain from someone else who owns a domain, or `deploy your own ENS registry`_. Note that while anyone can deploy their own ENS registry, those names will only be resolvable by users who reference that registry in their code.

Updating the registry from an Ethereum console
----------------------------------------------

First, download ensutils.js_ to your local machine, and import it into a running Ethereum console:

::

    loadScript('/path/to/ensutils.js');

This defines, amongst others, an object called 'ens' that implements the registry interface as documented in EIP137_.

Getting the owner of a name
---------------------------

You can retrieve the address of a name's owner using the `owner` function:

::

    > ens.owner(namehash('somename.eth'));
    "0xa303ddc620aa7d1390baccc8a495508b183fab59"

Getting the resolver for a name
-------------------------------

You can retrieve the address of a name's resolver using the `resolver` function:

::

    > ens.resolver(namehash('somename.eth'));
    "0xc68de5b43c3d980b0c110a77a5f78d3c4c4d63b4"

Setting a name's resolver
-------------------------

You can set the resolver contract for a name using `setResolver`:

::

    > ens.setResolver(namehash('somename.eth'), resolverAddress, {from: eth.accounts[0]});

A resolver is any contract that implements the resolver interface implemented in EIP137_. You can deploy your own resolver, or you can use a publicly available one; on the mainnet, a simple resolver that supports 'address' records and is usable by anyone is available; ensutils.js exposes it as `publicResolver`. To use it, first set it as the resolver for your name:

::

    ens.setResolver(namehash('somename.eth'), publicResolver.address, {from: eth.accounts[0]});

Then, call the resolver's `setAddr` method to set the address the name resolves to:

::

    publicResolver.setAddr(namehash('somename.eth'), eth.accounts[0], {from: eth.accounts[0]})

The above example configures 'somename.eth' to resolve to the address of your primary account.

Transferring a name
-------------------

You can transfer ownership of a name you control to someone else using `setOwner`:

::

    > ens.setOwner(namehash('somename.eth'), newOwner, {from: eth.accounts[0]});

Creating a subdomain
--------------------

You can assign ownership of subdomains of any name you own with the `setSubnodeOwner` function. For instance, to create a subdomain 'foo.somename.eth' and set yourself as the owner:

::

    > ens.setSubnodeOwner(namehash('somename.eth'), web3.sha3('foo'), eth.accounts[0], {from: eth.accounts[0]});

Or, to assign someone else as the owner:

::

    > ens.setSubnodeOwner(namehash('somename.eth'), web3.sha3('foo'), someAccount, {from: eth.accounts[0]});

Note the use of `web3.sha3()` instead of `namehash()` when specifying the subdomain being allocated.

The owner of a name can reassign ownership of subdomains at any time, even if they're owned by someone else.

Resolving Names
---------------

Now you're ready to resolve your newly created name. For details how, read `resolving ENS names`_

Interacting with ENS from a DApp
--------------------------------

An NPM module, ethereum-ens_, is available to facilitate interacting with the ENS from Javascript-based DApps.

Interacting with ENS from a contract
------------------------------------

The `ENS registry interface`_ provides a Solidity definition of the methods available for interacting with the ENS. Using this, and the address of the ENS registry, contracts can read and write the ENS registry directly.

A Solidity library to facilitate this will be available soon.

.. _`registering a name with the auction registrar`: auctions.html
.. _`registering a name with the test registrar`: testnames.html
.. _`deploy your own ENS registry`: deploying.html
.. _ensutils.js: https://github.com/ethereum/ens/blob/master/ensutils.js
.. _EIP137: https://github.com/ethereum/EIPs/issues/137
.. _`resolving ENS names`: resolving.html
.. _ethereum-ens: https://www.npmjs.com/package/ethereum-ens
.. _`ENS registry interface`: https://github.com/ethereum/ens/blob/master/interface.sol
