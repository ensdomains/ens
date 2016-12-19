********************************************
Registering a name with the FIFS registrar
********************************************

This guide assumes that you are attempting to register a name with a registrar that implements the first-in-first-served interface for registering domains. The public ENS deployment on Ropsten uses a first-in-first served registrar for the '.test' top level domain. Domains on this TLD are configured to expire, allowing anyone else to claim them, 28 days after registration.

If you want a permanent name, use the auction registrar instead; to learn how to register a name with that, read `registering a name with the auction registrar`_ instead. Note that once deployed on mainnet, this will be the only registrar available; '.test' is for Ropsten only.

First, download ensutils.js_ to your local machine, and import it into a running Ethereum console:

::

    loadScript('/path/to/ensutils.js');

This script defines an object `testRegistrar`, for interacting with the registrar for the .test TLD. If you want to interact with a different first-in-first-served registrar, you can instantiate it with:

::

    var myRegistrar = fifsRegistrarContract.at(address);

Before registering, check that nobody owns the name you want to register:

::

    new Date(testRegistrar.expiryTimes(web3.sha3('myname')).toNumber() * 1000)

If this line returns a date earlier than the current date, the name is available and you're good to go.

The FIFS registrar's interface is extremely simple, and exposes a method called `register` that you can call with the (hashed) name you want to register and the address you want to own the name. To register a name, simply call that method to send a registration transaction:

::

    testRegistrar.register(web3.sha3('myname'), eth.accounts[0], {from: eth.accounts[0]});

Once this transaction is mined, assuming the name was not already assigned, it will be assigned to you, and you can proceed to `interact with the registry`_.

.. _`registering a name with the auction registrar`: auctions.html
.. _ensutils.js: https://github.com/ethereum/ens/blob/master/ensutils.js
.. _`interact with the registry`: interacting.html
