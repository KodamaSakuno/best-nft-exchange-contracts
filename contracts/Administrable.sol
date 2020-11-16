// SPDX-License-Identifier: MIT

pragma solidity ^0.6;

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract Administrable is Ownable {
    mapping(address => bool) public admins;

    constructor() public Ownable() {
        admins[owner()] = true;
    }

    modifier onlyAdmins() {
        require(admins[msg.sender]);
        _;
    }

    function addAdmin(address account) external onlyOwner {
        admins[account] = true;
    }
    function removeAdmin(address account) external onlyOwner {
        delete admins[account];
    }

    function isAdmin(address account) external view returns (bool) {
        return admins[account];
    }
}
