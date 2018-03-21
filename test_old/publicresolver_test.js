var assert = require('assert');
var async = require('async');
var Promise = require('bluebird');

var utils = require('./utils.js');
Promise.promisifyAll(utils);
var web3 = utils.web3;
Promise.promisifyAll(web3.eth);

var accounts = null;

before(function() {
	return web3.eth.getAccountsAsync()
		.then(acct => accounts = acct);
});

describe('PublicResolver', function() {
	var resolverCode = null;
	var resolver = null;
	var ens = null;

	before(function() {
		this.timeout(10000);
		resolverCode = utils.compileContract(['AbstractENS.sol', 'PublicResolver.sol']).contracts['PublicResolver.sol:PublicResolver'];
	});

	beforeEach(function() {
		this.timeout(4000);
		return utils.deployENSAsync(accounts[0])
			.then(_ens => {
				ens = _ens;
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
								resolve(contract);
							} else {
								// There is to hope that reject or resolve is called
							}
						});

				});
			})
			.then(contract => {
				resolver = Promise.promisifyAll(contract);
				return ens.setSubnodeOwnerAsync(0, web3.sha3('eth'), accounts[0], {from: accounts[0]});
			});
	});

	describe('fallback function', function() {

		it('forbids calls to the fallback function with 0 value', function() {
			return web3.eth.sendTransactionAsync({
					from: accounts[0],
					to: resolver.address,
					gas: 3000000
				})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids calls to the fallback function with 1 value', function() {
			return web3.eth.sendTransactionAsync({
					from: accounts[0],
					to: resolver.address,
					gas: 3000000,
					value: 1
				})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('supportsInterface function', function() {

		it('supports known interfaces', function() {
			this.slow(250);
			return Promise.all([
					resolver.supportsInterfaceAsync("0x3b3b57de"),
					resolver.supportsInterfaceAsync("0xd8389dc5"),
					resolver.supportsInterfaceAsync("0x691f3431"),
					resolver.supportsInterfaceAsync("0x2203ab56"),
					resolver.supportsInterfaceAsync("0xc8690233"),
					resolver.supportsInterfaceAsync("0x59d1d43c")
				])
				.then(results => {
					assert.equal(results[0], true);
					assert.equal(results[1], true);
					assert.equal(results[2], true);
					assert.equal(results[3], true);
					assert.equal(results[4], true);
					assert.equal(results[5], true);
				});
		});

		it('does not support a random interface', function() {
			this.slow(150);
			return resolver.supportsInterfaceAsync("0x3b3b57df")
				.then(result => assert.equal(result, false));
		});

	});

	describe('setAddr function', function() {

		it('permits setting address by owner', function() {
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]});
		});

		it('can overwrite previously set address', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[0], {from: accounts[0]}));
		});

		it('can overwrite to same address', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]}));
		});

		it('forbids setting new address by non-owners', function() {
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids writing same address by non-owners', function() {
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids overwriting existing address by non-owners', function() {
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[0], {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('addr function', function() {

		it('returns zero when fetching nonexistent addresses', function() {
			this.slow(200);
			return resolver.addrAsync(utils.node)
				.then(result => assert.equal(result, "0x0000000000000000000000000000000000000000"));
		});

		it('returns previously set address', function() {
			this.slow(200);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.addrAsync(utils.node))
				.then(address => assert.equal(address, accounts[1]));
		});

		it('returns overwritten address', function() {
			this.slow(300);
			return resolver.setAddrAsync(utils.node, accounts[1], {from: accounts[0]})
				.then(txid => resolver.setAddrAsync(utils.node, accounts[0], {from: accounts[0]}))
				.then(txid => resolver.addrAsync(utils.node))
				.then(address => assert.equal(address, accounts[0]));
		});

	});

	describe('setContent function', function() {

		it('permits setting content by owner', function() {
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]});
		});

		it('can overwrite previously set content', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash2', {from: accounts[0]}));
		});

		it('can overwrite to same content', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]}));
		});

		it('forbids setting content by non-owners', function() {
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids writing same content by non-owners', function() {
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash1', {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids overwriting existing content by non-owners', function() {
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash2', {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('content function', function() {

		it('returns empty when fetching nonexistent content', function() {
			this.slow(200);
			return resolver.contentAsync(utils.node)
				.then(result => assert.equal(result, "0x0000000000000000000000000000000000000000000000000000000000000000"));
		});

		it('returns previously set content', function() {
			this.slow(200);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.contentAsync(utils.node))
				.then(content => assert.equal(web3.toUtf8(content), 'hash1'));
		});

		it('returns overwritten content', function() {
			this.slow(300);
			return resolver.setContentAsync(utils.node, 'hash1', {from: accounts[0]})
				.then(txid => resolver.setContentAsync(utils.node, 'hash2', {from: accounts[0]}))
				.then(txid => resolver.contentAsync(utils.node))
				.then(content => assert.equal(web3.toUtf8(content), 'hash2'));
		});

	});

	describe('setName function', function() {

		it('permits setting name by owner', function() {
			return resolver.setNameAsync(utils.node, 'name1', {from: accounts[0]});
		});

		it('can overwrite previously set names', function() {
			this.slow(200);
			return resolver.setNameAsync(utils.node, 'name1', {from: accounts[0]})
				.then(txid => resolver.setNameAsync(utils.node, 'name2', {from: accounts[0]}));
		});

		it('forbids setting name by non-owners', function() {
			return resolver.setNameAsync(utils.node, 'name1', {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});
	});

	describe('name function', function() {

		it('returns empty when fetching nonexistent name', function() {
			this.slow(200);
			return resolver.nameAsync(utils.node)
				.then(result => assert.equal(result, ""));
		});

		it('returns previously set name', function() {
			this.slow(200);
			return resolver.setNameAsync(utils.node, 'name1', {from: accounts[0]})
				.then(txid => resolver.nameAsync(utils.node))
				.then(name => assert.equal(name, 'name1'));
		});

		it('returns overwritten name', function() {
			this.slow(300);
			return resolver.setNameAsync(utils.node, 'name1', {from: accounts[0]})
				.then(txid => resolver.setNameAsync(utils.node, 'name2', {from: accounts[0]}))
				.then(txid => resolver.nameAsync(utils.node))
				.then(name => assert.equal(name, 'name2'));
		});

	});

	describe('setPubkey function', function() {

		it('permits setting public key by owner', function() {
			return resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[0]});
		});

		it('can overwrite previously set value', function() {
			this.slow(200);
			return resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[0]})
				.then(txid => resolver.setPubkeyAsync(utils.node, 3, 4, {from: accounts[0]}));
		});

		it('can overwrite to same value', function() {
			this.slow(200);
			return resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[0]})
				.then(txid => resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[0]}));
		});

		it('forbids setting value by non-owners', function() {
			return resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids writing same value by non-owners', function() {
			return resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[0]})
				.then(txid => resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids overwriting existing value by non-owners', function() {
			return resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[0]})
				.then(txid => resolver.setPubkeyAsync(utils.node, 3, 4, {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('pubkey function', function() {

		it('returns empty when fetching nonexistent values', function() {
			this.slow(200);
			return resolver.pubkeyAsync(utils.node)
				.then(result => assert.deepEqual(result, [
					"0x0000000000000000000000000000000000000000000000000000000000000000",
					"0x0000000000000000000000000000000000000000000000000000000000000000"]));
		});

		it('returns previously set values', function() {
			this.slow(200);
			return resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[0]})
				.then(txid => resolver.pubkeyAsync(utils.node))
				.then(pubkey => assert.deepEqual(pubkey, [
					"0x1000000000000000000000000000000000000000000000000000000000000000",
					"0x2000000000000000000000000000000000000000000000000000000000000000"]));
		});

		it('returns overwritten values', function() {
			this.slow(300);
			return resolver.setPubkeyAsync(utils.node, 1, 2, {from: accounts[0]})
				.then(txid => resolver.setPubkeyAsync(utils.node, 3, 4, {from: accounts[0]}))
				.then(txid => resolver.pubkeyAsync(utils.node))
				.then(pubkey => assert.deepEqual(pubkey, [
					'0x3000000000000000000000000000000000000000000000000000000000000000',
  					'0x4000000000000000000000000000000000000000000000000000000000000000']));
		});

	});

	describe('ABI', function() {
		it('returns a contentType of 0 when nothing is available', function() {
			return resolver.ABIAsync(utils.node, 0xFFFFFFFF)
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [0, "0x"]));
		});

		it('returns an ABI after it has been set', function() {
			return resolver.setABIAsync(utils.node, 0x1, "foo", {from: accounts[0]})
				.then(txid => resolver.ABIAsync(utils.node, 0x1))
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [1, "0x666f6f"]));
		});

		it('returns the first valid ABI', function() {
			return resolver.setABIAsync(utils.node, 0x2, "foo", {from: accounts[0]})
				.then(txid => resolver.setABIAsync(utils.node, 0x4, "bar", {from: accounts[0]}))
				.then(txid => resolver.ABIAsync(utils.node, 0x7))
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [2, "0x666f6f"]))
				.then(result => resolver.ABIAsync(utils.node, 0x5))
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [4, "0x626172"]));
		});

		it('allows deleting ABIs', function() {
			return resolver.setABIAsync(utils.node, 0x1, "foo", {from: accounts[0]})
				.then(txid => resolver.setABIAsync(utils.node, 0x1, "", {from: accounts[0]}))
				.then(txid => resolver.ABIAsync(utils.node, 0x1))
				.then(result => assert.deepEqual([result[0].toNumber(), result[1]], [0, "0x"]));
		});

		it('rejects invalid content types', function() {
			return resolver.setABIAsync(utils.node, 0x3, "foo", {from: accounts[0]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids setting value by non-owners', function() {
			return resolver.setABIAsync(utils.node, 0x1, "foo", {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});
	});

	describe('setText function', function() {
	    var url = "https://ethereum.org";
	    var url2 = "https://github.com/ethereum";

		it('permits setting text by owner', function() {
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]});
		});

		it('can overwrite previously set text', function() {
			this.slow(200);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url2, {from: accounts[0]}));
		});

		it('can overwrite to same text', function() {
			this.slow(200);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]}));
		});

		it('forbids setting new text by non-owners', function() {
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[1]})
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids writing same text by non-owners', function() {
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url, {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

		it('forbids overwriting existing text by non-owners', function() {
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url, {from: accounts[1]}))
				.then(
					tx => { throw new Error("expected to be forbidden"); },
					err => assert.ok(err, err)
				);
		});

	});

	describe('text function', function() {
	    var url = "https://ethereum.org";
	    var email = "test@ethereum.org";

		it('returns empty string when fetching nonexistent addresses', function() {
			this.slow(200);
			return resolver.textAsync(utils.node, "url")
				.then(result => assert.equal(result, ""));
		});

		it('returns previously set text', function() {
			this.slow(200);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.textAsync(utils.node, "url"))
				.then(result => assert.equal(result, url));
		});

		it('returns different text values for different keys', function() {
			this.slow(200);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.textAsync(utils.node, "url"))
				.then(result => assert.equal(result, url))

				// Set e-mail
				.then(txid => resolver.setTextAsync(utils.node, "email", email, {from: accounts[0]}))
				.then(txid => resolver.textAsync(utils.node, "email"))
				.then(result => assert.equal(result, email))

				// Check url is still unchanged
				.then(txid => resolver.textAsync(utils.node, "url"))
				.then(result => assert.equal(result, url));
		});

		it('returns overwritten text', function() {
			this.slow(300);
			return resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]})
				.then(txid => resolver.setTextAsync(utils.node, "url", url, {from: accounts[0]}))
				.then(txid => resolver.textAsync(utils.node, "url"))
				.then(result => assert.equal(result, url));
		});

	});

});
