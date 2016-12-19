*********************
Resolving ENS names
*********************

This page describes how ENS name resolution works at the contract level. For convenient use in DApps, an NPM package, ethereum-ens_ is available which abstracts away much of the detail and makes name resolution a straightforward process.

First, download ensutils.js_ to your local machine, and import it into a running Ethereum console:

::

    loadScript('/path/to/ensutils.js');

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

.. _ethereum-ens: https://www.npmjs.com/package/ethereum-ens
.. _ensutils.js: https://github.com/ethereum/ens/blob/master/ensutils.js
