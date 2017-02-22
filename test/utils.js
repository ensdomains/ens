var assert = require('assert');
var async = require('async');
var fs = require('fs');
var solc = require('solc');
var TestRPC = require('ethereumjs-testrpc');
var Web3 = require('web3');

var web3 = new Web3();
web3.setProvider(TestRPC.provider());

var ensCode = null;
var ensLLLCode = null;

function compileContract(filenames) {
	var sources = {}
	for(var i = 0; i < filenames.length; i++)
		sources[filenames[i]] = fs.readFileSync(filenames[i]).toString();
	var compiled = solc.compile({sources: sources}, 1);
	assert.equal(compiled.errors, undefined, compiled.errors);
	return compiled;
}

module.exports = {
	INVALID_JUMP: "invalid JUMP",
	node: web3.sha3("0x0000000000000000000000000000000000000000000000000000000000000000" + web3.sha3('eth').slice(2), {encoding: 'hex'}),
	compileContract: compileContract,
	deployENS: function (account, done) {
		if(ensCode == null)
			ensCode = compileContract(['ENS.sol', 'interface.sol']).contracts['ENS.sol:ENS'];
		return web3.eth.contract(JSON.parse(ensCode.interface)).new(
		    {
		    	from: account,
		     	data: ensCode.bytecode,
		     	gas: 4700000
		   	}, function(err, contract) {
		   	    assert.equal(err, null, err);
		   	    if(contract.address != undefined) {
		   	    	done();
			   	}
		   });
	},
	deployENSLLL: function(account, done) {
		if(ensLLLCode == null) {
			ensLLLCode = {
				bytecode: fs.readFileSync('ENS.lll.bin').toString().trim(),
				interface: fs.readFileSync('abi/AbstractENS.abi').toString()
			}
		}
		return web3.eth.contract(JSON.parse(ensLLLCode.interface)).new(
		{
			from: account,
			data: ensLLLCode.bytecode,
			gas: 4700000
		}, function(err, contract) {
			assert.equal(err, null, err);
			if(contract.address != undefined) {
				done();
			}
		});
	},
	web3: web3,
	TestRPC: TestRPC
};
