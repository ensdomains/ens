var assert = require('assert');
var async = require('async');
var Promise = require('bluebird');

var utils = require('./utils.js');
Promise.promisifyAll(utils);
var web3 = utils.web3;
Promise.promisifyAll(web3.eth);

var accounts = null;
var node = null;

before(function() {
    return web3.eth.getAccountsAsync()
        .then(function(acct) {
            accounts = acct
            node = web3.sha3('0000000000000000000000000000000000000000000000000000000000000000'
                             + web3.sha3(accounts[0].slice(2).toLowerCase()).slice(2),
                             {encoding: 'hex'});
        });
});

describe('ReverseRegistrar', function() {
    var registrarCode = null;
    var registrar = null;
    var ens = null;


    before(function() {
        this.timeout(10000);
        registrarCode = utils.compileContract(['interface.sol', 'ReverseRegistrar.sol']).contracts['ReverseRegistrar.sol:ReverseRegistrar'];
    });

    beforeEach(function() {
        this.timeout(4000);
        return utils.deployENSAsync(accounts[0])
            .then(function(_ens) {
                ens = _ens;
                return new Promise(function(resolve, reject) {
                    web3.eth.contract(JSON.parse(registrarCode.interface)).new(
                        ens.address,
                        0,
                        {
                            from: accounts[0],
                            data: registrarCode.bytecode,
                            gas: 4700000
                        },
                        function(err, contract) {
                            if (err) {
                                reject(err);
                            } else if (typeof contract.address !== "undefined") {
                                resolve(contract);
                            }
                        });
                });
            })
            .then(function(contract) {
                registrar = Promise.promisifyAll(contract);
                return ens.setOwnerAsync(0, registrar.address, {from: accounts[0]});
            });
    });

    it('calculates node hashes correctly', function() {
        this.slow(150);
        return registrar.nodeAsync(accounts[0])
            .then(function(hash) {
                assert.equal(hash, node);
            });
    });

    it('allows an account to claim its address', function() {
        this.slow(150);
        return registrar.claimAsync(accounts[1], {from: accounts[0]})
            .then(function(txHash) {
                return ens.ownerAsync(node);
            })
            .then(function(result) {
                assert.equal(result, accounts[1]);
            });
    });
});
