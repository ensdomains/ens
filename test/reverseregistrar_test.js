var assert = require('assert');
var async = require('async');

var utils = require('./utils.js');
var web3 = utils.web3;

var accounts = null;
var node = null;

before(function(done) {
    web3.eth.getAccounts(function(err, acct) {
        accounts = acct
        node = web3.sha3('0000000000000000000000000000000000000000000000000000000000000000'
                         + web3.sha3(accounts[0].slice(2).toLowerCase()).slice(2),
                         {encoding: 'hex'});
        done();
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

    beforeEach(function(done) {
        async.series([
            function(done) { ens = utils.deployENS(accounts[0], done); },
            function(done) {
                registrar = web3.eth.contract(JSON.parse(registrarCode.interface)).new(
                    ens.address,
                    0,
                    {
                        from: accounts[0],
                        data: registrarCode.bytecode,
                        gas: 4700000
                    }, function(err, contract) {
                        if(contract.address != undefined)
                            ens.setOwner(0, registrar.address, {from: accounts[0]}, done);
                    });
            }],
            done
        );
    });

    it('calculates node hashes correctly', function(done) {
        registrar.node(accounts[0], function(err, hash) {
            assert.equal(err, null, err);
            assert.equal(hash, node);
            done();
        });
    });

    it('allows an account to claim its address', function(done) {
        async.series([
            function(done) {
                registrar.claim(accounts[1], {from: accounts[0]}, done);
            },
            function(done) {
                ens.owner(node, function(err, result) {
                    assert.equal(err, null, err);
                    assert.equal(result, accounts[1]);
                    done();
                });
            }],
            done
        );
    })
});
