// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IFtmX {
    function mint(address to, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}

contract FTMStaking {
    IFtmX public immutable FtmX;
    mapping(uint256 => bool) public isWrIDUsed;
    mapping(uint256 => address) public wrIDToUser;
    mapping(uint256 => uint256) public wrIDToAmount;

    constructor(IFtmX _ftmx) {
        FtmX = _ftmx;
    }

    function getExchangeRate(uint256 ftmAmount) public pure returns (uint256) {
        return ftmAmount;
    }

    function deposit() external payable {
        FtmX.mint(msg.sender, msg.value);
    }

    function undelegate(uint256 wrID, uint256 amount) external {
        require(!isWrIDUsed[wrID], "wrID already used");
        isWrIDUsed[wrID] = true;

        FtmX.burnFrom(msg.sender, amount);

        wrIDToAmount[wrID] = amount;
        wrIDToUser[wrID] = msg.sender;
    }

    function withdraw(uint256 wrID) external {
        require(wrIDToUser[wrID] == msg.sender, "Invalid request");
        uint256 amount = wrIDToAmount[wrID];
        delete wrIDToUser[wrID];
        delete wrIDToAmount[wrID];
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send FTM");
    }
}
