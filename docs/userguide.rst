**********
User Guide
**********

This user guide is intended for anyone wanting to register, configure, and update ENS names using a Javascript console and web3.js. Before starting, open up a geth console, download ensutils.js_ or `ensutils-ropsten.js`_ to your local machine, and import it into a running Ethereum console:

::

    loadScript('/path/to/ensutils.js');

.. _fifs:

Registering a name with the FIFS registrar
==========================================

The public ENS deployment on Ropsten uses a first-in-first served registrar for the '.test' top level domain. Domains on this TLD are configured to expire, allowing anyone else to claim them, 28 days after registration.

ensutils.js defines an object `testRegistrar`, for interacting with the registrar for the `.test` TLD. If you want to interact with a different first-in-first-served registrar, you can instantiate it with:

::

    var myRegistrar = fifsRegistrarContract.at(address);

Before registering, check that nobody owns the name you want to register:

::

    new Date(testRegistrar.expiryTimes(web3.sha3('myname')).toNumber() * 1000)

If this line returns a date earlier than the current date, the name is available and you're good to go.

The FIFS registrar's interface is extremely simple, and exposes a method called `register` that you can call with the (hashed) name you want to register and the address you want to own the name. To register a name, simply call that method to send a registration transaction:

::

    testRegistrar.register(web3.sha3('myname'), eth.accounts[0], {from: eth.accounts[0]});

Once this transaction is mined, assuming the name was not already assigned, it will be assigned to you, and you can proceed to :ref:`interacting`.

.. _auctions:

Registering a name with the auction registrar
=============================================

Once deployed on mainnet, ENS names will be handed out via an auction process, on the '.eth' top-level domain. A preview of this is available on the Ropsten testnet, and you can register names via it right now. Any names you register will persist until launch on mainnet, at which point the auction registrar on Ropsten will be deprecated and eventually deleted.

This registrar implements a blind auction, and is described in EIP162_. Names are initially required to be at least 7 characters long.

Registering a name with the auction registrar is a multi-step process.

Starting an auction
-------------------

Before placing a bid, you need to check if the name is available. Run this code to check:

::

    ethRegistrar.entries(web3.sha3('name'))[0]

If the returned value is `0`, the name is available, and not currently up for auction. If the returned value is `1`, the name is currently up for auction. Any other value indicates the name is not available.

To start an auction for a name that's not already up for auction, call `startAuction`:

::

    ethRegistrar.startAuction(web3.sha3('name'), {from: eth.accounts[0], gas: 100000});

You can also start auctions for several names simultaneously, to disguise which name you're actually interested in registering:

::

    ethRegistrar.startAuctions([web3.sha3('decoy1'), web3.sha3('name'), web3.sha3('decoy2')], {from: eth.accounts[0], gas: 1000000});

Auctions normally run for 1 week, but auctions that start in the first week after deployment of ENS are extended to end 4 weeks after initial deployment.

When a name is available for auction, you can check the end time of the auction as follows:

::

    new Date(ethRegistrar.entries(web3.sha3('name'))[2].toNumber() * 1000)

Placing a bid
-------------

Bids can be placed at any time during an auction except in the last 48 hours (the 'reveal period'). Before trying to place a bid, make sure an auction is currently underway, as described above, and has more than 48 hours left to run.

To bid on an open auction, you need several pieces of data:

 - The name you want to register
 - The account you want to register the name under
 - The maximum amount you're willing to pay for the name
 - A random 'salt' value

In addition, you need to decide how much Ether you want to deposit with the bid. This must be at least as much as the value of your bid, but can be more, in order to disguise the true value of the bid.

First, start by generating a secret value. An easy way to do this is to use random.org_. Store this value somewhere secure - if you lose it, you lose your deposit, and your chance at winning the auction!

Now, you can generate your 'sealed' bid, with the following code:

::

    var bid = ethRegistrar.shaBid(web3.sha3('name'), eth.accounts[0], web3.toWei(1, 'ether'), web3.sha3('secret'));

The arguments are, in order, the name you want to register, the account you want to register it under, your maximum bid, and the secret value you generated earlier.

Next, submit your bid to the registrar:

::

    ethRegistrar.newBid(bid, {from: eth.accounts[0], value: web3.toWei(2, 'ether'), gas: 500000});

In the example above, we're sending 2 ether, even though our maximum bid is 1 ether; this is to disguise the true value of our bid. When we reveal our bid later, we will get the extra 1 ether back; the most we can pay for the name is 1 ether, as we specified when generating the bid.

Now it's a matter of waiting until the reveal period before revealing your bid. Run the command to check the expiration date of the auction again, and make sure to come back in the final 48 hours of the auction:

::

    new Date(ethRegistrar.entries(web3.sha3('name'))[2].toNumber() * 1000)

Revealing your bid
------------------

In order to win an auction, you must 'reveal' your bid. This can be done at any time after you place your bid, but it's recommended you don't do so until the last 48 hours, at which point new bids are prohibited. If you don't reveal your bid by the time the auction ends, your deposit is forfeit - so make sure you store your salt in a safe place, and come back before the auction ends in order to reveal your bid.

To reveal, call the `unsealBid` function with the same values you provided earlier:

::

    ethRegistrar.unsealBid(web3.sha3('name'), eth.accounts[0], web3.toWei(1, 'ether'), web3.sha3('secret'), {from: eth.accounts[0], gas: 500000});

The arguments to `unsealBid` have the same order and meaning as those to `shaBid`, described in the bidding step.

After revealing your bid, the auction will be updated. If your bid is less than a previously revealed bid, you will be refunded the whole amount of your bid. If your bid is the largest revealed so far, you will be set as the current leading bidder, and the difference between the actual amount of your bid and the amount you sent will be refunded immediately. If you are later outbid, your bid will be sent back to you at that point.

At any time, you can check the current winning bidder with:

::

    deedContract.at(ethRegistrar.entries(web3.sha3('name'))[1]).owner();

and the value of the current winning bid with

::

    web3.fromWei(ethRegistrar.entries(web3.sha3('name'))[3], 'ether');

Finalizing the auction
----------------------

Once the auction has completed, it must be finalized in order for the name to be assigned to the winning bidder. Any user can perform this step; to do it yourself, call the `finalizeAuction` function like so:

::

    ethRegistrar.finalizeAuction(web3.sha3('name'), {from: eth.accounts[0], gas: 500000});

Once called, the winning bidder will be refunded the difference between their bid and the next highest bidder. If you're the only bidder, you get back all but 0.1 eth of your bid. The winner is then assigned the name in ENS.

If you are the winning bidder, congratulations!

.. _interacting:

Interacting with the ENS registry
=================================

The ENS registry forms the central component of ENS, mapping from hashed names to resolvers, as well as the owners of the names and their TTL (caching time-to-live).

Before you can make any changes to the ENS registry, you need to control an account that has ownership of a name in ENS. To obtain an ENS name on the Ropsten testnet, see :ref:`auctions` for '.eth', or :ref:`fifs` for '.test'. Names on '.test' are temporary, and can be claimed by someone else 28 days later.

Alternately, you can obtain a subdomain from someone else who owns a domain, or :doc:`deploying`. Note that while anyone can deploy their own ENS registry, those names will only be resolvable by users who reference that registry in their code.

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

Now you're ready to resolve your newly created name. For details how, read :ref:`resolving`.

Interacting with ENS from a DApp
--------------------------------

An NPM module, ethereum-ens_, is available to facilitate interacting with the ENS from Javascript-based DApps.

Interacting with ENS from a contract
------------------------------------

The `ENS registry interface`_ provides a Solidity definition of the methods available for interacting with the ENS. Using this, and the address of the ENS registry, contracts can read and write the ENS registry directly.

A Solidity library to facilitate this will be available soon.

.. _resolving:

Resolving ENS names
===================

This page describes how ENS name resolution works at the contract level. For convenient use in DApps, an NPM package, ethereum-ens_ is available which abstracts away much of the detail and makes name resolution a straightforward process.

Step by step
------------

Get the node ID (namehash output) for the name you want to resolve:

::

    var node = namehash('myname.eth');

Ask the ENS registry for the resolver responsible for that node:

::

    var resolverAddress = ens.resolver(node);

Create an instance of a resolver contract at that address:

::

    var resolver = resolverContract.at(resolverAddress);

Finally, ask the resolver what the address is:

::

    resolver.addr(node);

Oneliner
--------

This statement is equivalent to all of the above:

::

    resolverContract.at(ens.resolver(namehash('myname.eth'))).addr(namehash('myname.eth'));

For convenience, ensutils.js provides a function, `getAddr` that does all of this for you with the default ENS registry:

::

    getAddr('myname.eth')

.. _reverse:

Reverse name resolution
=======================

ENS also supports reverse resolution of Ethereum addresses. This allows an account (contract or external) to associate metadata with itself, such as its canonical name.

Reverse records are in the format `<ethereum address>.addr.reverse` - for instance, the official registry would have its reverse records at `314159265dd8dbb310642f98f50c066173c1259b.addr.reverse`.

`addr.reverse` has a registrar with a `claim` function, which permits any account to take ownership of its reverse record in ENS. The claim function takes one argument, the Ethereum address that should own the reverse record.

This permits a very simple pattern for contracts that wish to delegate control of their reverse record to their creator; they simply need to add this function call to their constructor:

::

    reverseRegistrar.claim(msg.sender)

Claiming your account
---------------------

Call the `claim` function on the `reverseRegistry` object:

::

    reverseRegistry.claim(eth.accounts[0], {from: eth.accounts[0]});

After that transaction is mined, the appropriate reverse record is now owned by your account, and, you can deploy a resolver and set records on it; see :ref:`interacting` for details.

.. _ethereum-ens: https://www.npmjs.com/package/ethereum-ens
.. _EIP137: https://github.com/ethereum/EIPs/issues/137
.. _`ENS registry interface`: https://github.com/ethereum/ens/blob/master/interface.sol
.. _EIP162: https://github.com/ethereum/EIPs/issues/162
.. _ensutils.js: https://github.com/ethereum/ens/blob/master/ensutils.js
.. _ensutils-ropsten.js: https://github.com/ethereum/ens/blob/master/ensutils-ropsten.js
.. _random.org: https://www.random.org/strings/?num=1&len=20&digits=on&upperalpha=on&loweralpha=on&unique=off&format=html&rnd=new
