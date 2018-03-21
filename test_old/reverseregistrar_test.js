var assert = require('assert');
var async = require('async');
var namehash = require('eth-ens-namehash');
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
            node = namehash(accounts[0].slice(2).toLowerCase() + ".addr.reverse");
        });
});

function assertIsContractError(err) {
    return assert.ok(err.toString().indexOf("invalid JUMP") != -1 || err.toString().indexOf("invalid opcode") != -1, err);
}

describe('ReverseRegistrar', function() {
    var resolverCode = null;
    var registrarCode = null;
    var registrar = null;
    var resolver = null;
    var ens = null;


    before(function() {
        this.timeout(10000);
        var compiled = utils.compileContract(['AbstractENS.sol', 'ReverseRegistrar.sol'])
        resolverCode = compiled.contracts['ReverseRegistrar.sol:DefaultReverseResolver'];
        registrarCode = compiled.contracts['ReverseRegistrar.sol:ReverseRegistrar'];
    });

    beforeEach(function() {
        this.timeout(4000);
        return utils.deployENSAsync(accounts[0])
            .then(function(_ens) {
                ens = Promise.promisifyAll(_ens);
                return new Promise(function(resolve, reject) {
                    web3.eth.contract(JSON.parse(resolverCode.interface)).new(
                        ens.address,
                        {
                            from: accounts[0],
                            data: resolverCode.bytecode,
                            gas: 4700000
                        },
                        function(err, contract) {
                            if (err) {
                                reject(err);
                            } else if (typeof contract.address !== "undefined") {
                                resolver = Promise.promisifyAll(contract);
                                resolve(resolver);
                            }
                        });
                });
            })
            .then(function(resolver) {
                return new Promise(function(resolve, reject) {
                    web3.eth.contract(JSON.parse(registrarCode.interface)).new(
                        ens.address,
                        resolver.address,
                        {
                            from: accounts[0],
                            data: registrarCode.bytecode,
                            gas: 4700000
                        },
                        function(err, contract) {
                            if (err) {
                                reject(err);
                            } else if (typeof contract.address !== "undefined") {
                                registrar = Promise.promisifyAll(contract);
                                resolve(registrar);
                            }
                        });
                });
            })
            .then(registrar => ens.setSubnodeOwnerAsync(0, web3.sha3('reverse'), accounts[0], {from: accounts[0]}))
            .then(result => ens.setSubnodeOwnerAsync(namehash('reverse'), web3.sha3('addr'), registrar.address, {from: accounts[0]}));
    });

    it('calculates node hashes correctly', function() {
        this.slow(150);
        return registrar.nodeAsync(accounts[0])
            .then(hash =>assert.equal(hash, node));
    });

    it('allows an account to claim its address', function() {
        this.slow(150);
        return registrar.claimAsync(accounts[1], {from: accounts[0]})
            .then(txHash => ens.ownerAsync(node))
            .then(result => assert.equal(result, accounts[1]));
    });

    it('allows an account to specify resolver', function() {
        this.slow(150);
        return registrar.claimWithResolverAsync(accounts[1], accounts[2], {from: accounts[0]})
            .then(txHash => ens.ownerAsync(node))
            .then(result => assert.equal(result, accounts[1]))
            .then(result => ens.resolverAsync(node))
            .then(result => assert.equal(result, accounts[2]));
    });

    it('does not overwrite resolver if not specified', function() {
        this.slow(150);
        return registrar.claimWithResolverAsync(accounts[1], accounts[2], {from: accounts[0]})
            .then(txHash => registrar.claimAsync(accounts[3], {from: accounts[0]}))
            .then(txHash => ens.ownerAsync(node))
            .then(result => assert.equal(result, accounts[3]))
            .then(result => ens.resolverAsync(node))
            .then(result => assert.equal(result, accounts[2]));
    })

    it('sets name records', function() {
        this.slow(300);
        return registrar.setNameAsync('testname', {from: accounts[0], gas: 1000000})
            .then(hash => ens.resolverAsync(node))
            .then(resolverAddr => assert.equal(resolverAddr, resolver.address))
            .then(result => resolver.nameAsync(node))
            .then(name => assert.equal(name, 'testname'));
    });

    it('allows the owner to update the name', function() {
        this.slow(150);
        return registrar.claimWithResolverAsync(accounts[1], resolver.address, {from: accounts[0]})
            .then(hash => resolver.setNameAsync(node, 'testname', {from: accounts[1]}))
            .then(hash => resolver.nameAsync(node))
            .then(result => assert.equal(result, 'testname'));
    });

    it('does not allow non-owners to update the name', function() {
        this.slow(150);
        return registrar.claimWithResolverAsync(accounts[1], resolver.address, {from: accounts[0]})
            .then(hash => resolver.setNameAsync(node, 'testname', {from: accounts[0]}))
            .then((done) => assert.fail("Expected exception"), assertIsContractError);
    });
});
