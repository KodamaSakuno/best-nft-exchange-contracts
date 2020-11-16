// SPDX-License-Identifier: MIT

pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "./Administrable.sol";

contract BestNftExchange is Administrable, IERC721Receiver {
    using SafeERC20 for IERC20;

    address public token;

    struct Order {
        address nft;
        uint256 id;
        address owner;
        uint256 price;
    }
    Order[] private _orders;
    uint256 private _totalOrder;

    constructor(address _token) public {
        token = _token;
    }

    function totalOrder() external view returns (uint256) {
        return _totalOrder;
    }
    function getOrders() external view returns (Order[] memory) {
        return _orders;
    }

    function buy(uint256 id) public payable {
        require(id < _totalOrder);
        Order memory order = _orders[id];
        IERC20 _token = IERC20(token);
        uint256 buyerBalance = _token.balanceOf(msg.sender);
        require(buyerBalance >= order.price);

        _token.safeTransferFrom(msg.sender, order.owner, order.price);
        IERC721(order.nft).safeTransferFrom(address(this), msg.sender, order.id);

        // TODO: Orders array modification
    }

    function revoke(uint256 id) public {
        require(id < _totalOrder);
        Order memory order = _orders[id];
        require(order.owner == msg.sender);

        IERC721(order.nft).safeTransferFrom(address(this), msg.sender, order.id);

        // TODO: Orders array modification
    }

    function set_price(uint256 id, uint256 price) external {
        require(id < _totalOrder);
        require(_orders[id].owner == msg.sender);

        _orders[id].price = price;
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external override returns (bytes4) {
        Order memory order = Order(operator, tokenId, from, 0);

        // TODO: Price is from data parameter
        // TODO: Orders array modification

        return IERC721Receiver.onERC721Received.selector;
    }

    function withdrawAll() external onlyAdmins {
        withdrawAmount(IERC20(token).balanceOf(address(this)));
    }
    function withdrawAmount(uint256 _amount) public onlyAdmins {
        IERC20(token).transfer(msg.sender, _amount);
    }
}
