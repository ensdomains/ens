var assert = require('assert');
var async = require('async');

var utils = require('./utils.js');
var web3 = utils.web3;

var accounts = null;

before(function(done) {
	web3.eth.getAccounts(function(err, acct) {
		accounts = acct
		done();
	});
});

describe('FIFSRegistrar', function() {
	var registrarCode = null;
	var registrar = null;
	var ens = null;


	before(function() {
		this.timeout(10000);
		registrarCode = utils.compileContract(['interface.sol', 'FIFSRegistrar.sol']).contracts['FIFSRegistrar.sol:FIFSRegistrar'];
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

	it('registers names', function(done) {
		async.series([
			function(done) {
				registrar.register(web3.sha3('eth'), accounts[0], {from: accounts[0]}, done);
			},
			function(done) {
				ens.owner(0, function(err, address) {
					assert.equal(err, null, err);
					assert.equal(address, registrar.address);
					done();
				});
			},
			function(done) {
				ens.owner(utils.node, function(err, address) {
					assert.equal(err, null, err);
					assert.equal(address, accounts[0]);
					done();
				});
			}],
			done
		);
	});

	it('transfers names', function(done) {
		async.series([
			function(done) {
				registrar.register(web3.sha3('eth'), accounts[0], {from: accounts[0]}, done);
			},
			function(done) {
				registrar.register(web3.sha3('eth'), accounts[1], {from: accounts[0]}, done);
			},
			function(done) {
				ens.owner(utils.node, function(err, address) {
					assert.equal(err, null, err);
					assert.equal(address, accounts[1]);
					done();
				});
			}],
			done
		);		
	});

	it('forbids transferring names you do not own', function(done) {
		async.series([
			function(done) {
				registrar.register(web3.sha3('eth'), accounts[1], {from: accounts[0]}, done);
			},
			function(done) {
				registrar.register(web3.sha3('eth'), accounts[0], {from: accounts[0]}, function(err, txid) {
					assert.ok(err.toString().indexOf(utils.INVALID_JUMP) != -1, err);
					done();
				});
			}],
			done
		);
	});
});
