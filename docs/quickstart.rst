**********
Quickstart
**********

Just want to get a name and make it resolve to something? Here's how.

First, download `ensutils.js`_ or `ensutils-ropsten.js`_ to your local machine, and import it into a running Ethereum console:

::

    loadScript('/path/to/ensutils.js');

Before registering, check that nobody owns the name you want to register:

::

    new Date(testRegistrar.expiryTimes(web3.sha3('myname')).toNumber() * 1000)

If this line returns a date earlier than the current date, the name is available and you're good to go. You can register the domain for yourself by running:

::

    testRegistrar.register(web3.sha3('myname'), eth.accounts[0], {from: eth.accounts[0]})

Next, tell the ENS registry to use the public resolver for your name:

::

    ens.setResolver(namehash('myname.test'), publicResolver.address, {from: eth.accounts[0]});

Once that transaction is mined, tell the resolver to resolve that name to your account:

::

    publicResolver.setAddr(namehash('myname.test'), eth.accounts[0], {from: eth.accounts[0]});

...or any other address:

::

    publicResolver.setAddr(namehash('myname.test'), '0x1234...', {from: eth.accounts[0]});

If you want, create a subdomain and do the whole thing all over again:

::

    ens.setSubnodeOwner(namehash('myname.test'), web3.sha3('foo'), eth.accounts[1], {from: eth.accounts[0]});
    ens.setResolver(namehash('foo.myname.test'), publicResolver.address, {from: eth.accounts[1]});
    ...

Finally, you can resolve your newly created name:

::

    getAddr('myname.eth')

which is shorthand for:

::

    resolverContract.at(ens.resolver(namehash('myname.eth'))).addr(namehash('myname.eth'))

.. _ensutils.js: https://github.com/ethereum/ens/blob/master/ensutils.js
.. _ensutils-ropsten.js: https://github.com/ethereum/ens/blob/master/ensutils-ropsten.js
