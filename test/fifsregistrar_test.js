var assert = require('assert');
var async = require('async');
var Promise = require('bluebird');

var utils = require('./utils.js');
Promise.promisifyAll(utils);
var web3 = utils.web3;
Promise.promisifyAll(web3.eth);

describe('FIFSRegistrar', function() {
	var registrarCode = null;
	var registrar = null;
	var ens = null;
	var accounts = null;

	before(function() {
		return web3.eth.getAccountsAsync()
			.then(acct => accounts = acct);
	});

	before(function() {
		this.timeout(10000);
		registrarCode = utils.compileContract(['AbstractENS.sol', 'FIFSRegistrar.sol']).contracts['FIFSRegistrar.sol:FIFSRegistrar'];
	});

	beforeEach(function() {
		this.timeout(4000);
		return utils.deployENSAsync(accounts[0])
			.then(function(_ens) {
				ens = _ens;
				return utils.promisifyContractFactory(
						web3.eth.contract(JSON.parse(registrarCode.interface)))
					.newAsync(
						ens.address,
						0,
						{
							from: accounts[0],
							data: registrarCode.bytecode,
							gas: 4700000
						});
			})
			.then(contract => {
				registrar = Promise.promisifyAll(contract);
				return ens.setOwnerAsync(0, registrar.address, {from: accounts[0]});
			});
	});

	it('registers names', function() {
		this.slow(300);
		return registrar.registerAsync(web3.sha3('eth'), accounts[0], {from: accounts[0]})
			.then(txHash => ens.ownerAsync(0))
			.then(address => {
				assert.equal(address, registrar.address);
				return ens.ownerAsync(utils.node);
			})
			.then(address => assert.equal(address, accounts[0]));
	});

	describe("transferring names", function() {

		beforeEach("register an unclaimed name", function() {
			return registrar.registerAsync(web3.sha3('eth'), accounts[0], {from: accounts[0]})
				.then(txHash => ens.ownerAsync(utils.node))
				.then(address => assert.equal(address, accounts[0]));
		});

		it("transfers the name you own", function() {
			this.slow(200);
			return registrar.registerAsync(web3.sha3('eth'), accounts[1], {from: accounts[0]})
				.then(txHash => ens.ownerAsync(utils.node))
				.then(address => assert.equal(address, accounts[1]));
		});

		it('forbids transferring the name you do not own', function() {
			return registrar.registerAsync(web3.sha3('eth'), accounts[1], {from: accounts[1]})
				.then(
					txHash => { throw(new Error("expected to be forbidden")); },
					err => assert.ok(err, err)
				);
		});
	});
});
