**********
Quickstart
**********

Just want to get a name and make it resolve to something? Here's how.

**NOTE**: This quickstart uses 'ensutils.js', a simple Javascript file that facilitates getting started with ENS. You should *NOT* use this in production code - it exists purely for interactive experimentation with the console!

First, make sure your client is in **sync with a network** (mainnet, ropsten, rinkeby, etc.). You can use eth.syncing in your Ethereum console to track progress.

You can utilize geth: https://github.com/ethereum/go-ethereum to connect a network and begin the process of syncing the chain.

Next, start an Ethereum console:

::

    Mainnet: geth attach
    Ropsten: geth --testnet attach
    Rinkeby: geth --rinkeby attach

Download `ensutils-testnet.js`_ to your local machine, and import it into an Ethereum console on a node synced to ropsten or rinkeby:

::

    loadScript('/path/to/ensutils-testnet.js'); // This will connect to the ropsten testnet

If you want to use Rinkeby, you'll need to change in ensutils-testnet.js:

::

        contract address: 0xe7410170f87102df0055eb195163a03b7f2bff4a (line 220)
        publicResolver address: 0x5d20cf83cb385e06d2f2a892f9322cd4933eacdc (line 1314)

If you need to unlock your account to execute certain transactions:

::

    // Careful as this will record your password in your history.
    // You can unlock accounts with geth as well to avoid this.

    web3.personal.unlockAccount(web3.personal.listAccounts[0],"<password>", 15000) // 15,000 seconds

Before registering, check that nobody owns the name you want to register:

::

    new Date(testRegistrar.expiryTimes(web3.sha3('myname')).toNumber() * 1000)

If this line returns a date earlier than the current date, the name is available and you're good to go. You can register the domain for yourself by running:

::

    // This uses the .test registrar and will let you register the sub-domain myname under .test
    testRegistrar.register(web3.sha3('myname'), eth.accounts[0], {from: eth.accounts[0]})

Next, tell the ENS registry to use the public resolver for your name:

::

    ens.setResolver(namehash('myname.test'), publicResolver.address, {from: eth.accounts[0]});

Once that transaction is mined (you can use `etherscan <https://ropsten.etherscan.io>`_ to do so), tell the resolver to resolve that name to your account:

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

    getAddr('myname.test')

which is shorthand for:

::

    resolverContract.at(ens.resolver(namehash('myname.test'))).addr(namehash('myname.test'))

.. _ensutils.js: https://github.com/ethereum/ens/blob/master/ensutils.js
.. _ensutils-testnet.js: https://github.com/ethereum/ens/blob/master/ensutils-testnet.js
