*******************
Introduction
*******************

..  image:: img/ens-logo.jpg
   :height: 351px
   :width: 300px
   :scale: 50%
   :alt: ENS logo
   :align: right

ENS is the Ethereum Name Service, a distributed, extensible naming system based on the Ethereum blockchain.

ENS can be used to resolve a wide variety of resources. The initial standard for ENS defines resolution for Ethereum addresses, but the system is extensible by design, allowing more resource types to be resolved in future without the core components of ENS requiring upgrades.

ENS is deployed on the Ropsten testnet at 0x112234455c3a32fd11230c42e7bccd4a84e02010_. Users may register names under two top level domains:

 - eth_, which uses an auction based registrar with the same functionality as the eventual deployment on the main network, and allows users to keep names indefinitely.
 - test_, which allows anyone to claim an unused name for test purposes, which expires after 28 days.

Quickstart
----------

Just want to get a name and make it resolve to something? Here's how.

First, register a .eth_ domain or a .test_.

Next, in your Ethereum console, tell the ENS registry to use the public resolver for your name:

::

    ens.setResolver(namehash('myname.eth'), publicResolver.address, {from: eth.accounts[0]);

Once that transaction is mined, tell the resolver to resolve that name to your account:

::

    publicResolver.setAddr(namehash('myname.eth'), eth.accounts[0], {from: eth.accounts[0]});

...or any other account:

::

    publicResolver.setAddr(namehash('myname.eth'), '0x1234...', {from: eth.accounts[0]});

If you want, create a subdomain and do the whole thing all over again:

::

    ens.setSubnodeOwner(namehash('myname.eth'), web3.sha3('foo'), eth.accounts[1], {from: eth.accounts[0]});
    ens.setResolver(namehash('foo.myname.eth'), resolver.address, {from: eth.accounts[1]});
    ...

Finally, you can resolve your newly created name:

::

    getAddr('myname.eth')

which is shorthand for:

::

    resolverContract.at(ens.resolver(namehash('myname.eth'))).addr(namehash('myname.eth'))

Resources
---------

 - EIP137_ - Ethereum Name Service
 - EIP162_ - Initial ENS Registrar Specification
 - ethereum-ens_ Javascript library
 - Nick's talk on ENS at DevCon 2: https://www.youtube.com/watch?v=pLDDbCZXvTE
 - DevCon 2 talk slides: https://arachnid.github.io/devcon2/#/title


 .. _0x112234455c3a32fd11230c42e7bccd4a84e02010: https://testnet.etherscan.io/address/0x112234455c3a32fd11230c42e7bccd4a84e02010
 .. _eth: auctions.html
 .. _test: testnames.html
 .. _EIP137: https://github.com/ethereum/EIPs/issues/137
 .. _EIP162: https://github.com/ethereum/EIPs/issues/162
 .. _ethereum-ens: https://www.npmjs.com/package/ethereum-ens
