***********************
Reverse name resolution
***********************

ENS also supports reverse resolution of Ethereum addresses. This allows an account (contract or external) to associate metadata with itself, such as its canonical name.

Reverse records are in the format `<ethereum address>.addr.reverse` - for instance, the official registry would have its reverse records at `112234455c3a32fd11230c42e7bccd4a84e02010.addr.reverse`.

`addr.reverse` has a registrar with a `claim` function, which permits any account to take ownership of its reverse record in ENS. The claim function takes one argument, the Ethereum address that should own the reverse record.

This permits a very simple pattern for contracts that wish to delegate control of their reverse record to their creator; they simply need to add this function call to their constructor:

::

    reverseRegistrar.claim(msg.sender)

Claiming your account
---------------------

First, download ensutils.js_ to your local machine, and import it into a running Ethereum console:

::

    loadScript('/path/to/ensutils.js');

Next, call the `claim` function on the `reverseRegistry` object:

::

    reverseRegistry.claim(eth.accounts[0], {from: eth.accounts[0]});

After that transaction is mined, the appropriate reverse record is now owned by your account, and, you can deploy a resolver and set records on it; see `interacting with the ENS registry`_ for details.

.. _ensutils.js: https://github.com/ethereum/ens/blob/master/ensutils.js
.. _`interacting with the ENS registry`: interacting.html
