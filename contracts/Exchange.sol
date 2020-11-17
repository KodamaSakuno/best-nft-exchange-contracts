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
    function getOrders() external view returns (Order[] memory result) {
        result = new Order[](_totalOrder);

        for (uint256 i = 0; i < _totalOrder; i++) {
            result[i] = _orders[i];
        }
    }
    function getOrder(uint256 id) external view returns (Order memory) {
        require(id >= 0 && id < _totalOrder, "BestNftExchange: id out of range");
        return _orders[id];
    }

    function buy(uint256 id) external {
        require(id >= 0 && id < _totalOrder, "BestNftExchange: id out of range");
        Order memory order = _orders[id];
        IERC20 _token = IERC20(token);
        uint256 buyerBalance = _token.balanceOf(msg.sender);
        require(buyerBalance >= order.price, "BestNftExchange: insufficient balance");

        _token.safeTransferFrom(msg.sender, order.owner, order.price);
        IERC721(order.nft).safeTransferFrom(address(this), msg.sender, order.id);

        removeOrder(id);
    }

    function revoke(uint256 id) external {
        require(id >= 0 && id < _totalOrder, "BestNftExchange: id out of range");
        Order memory order = _orders[id];
        require(order.owner == msg.sender, "BestNftExchange: not order owner");

        IERC721(order.nft).safeTransferFrom(address(this), msg.sender, order.id);

        removeOrder(id);
    }

    function removeOrder(uint256 id) internal {
        if (_totalOrder == 1) {
            _orders.pop();
            return;
        }

        Order memory lastOrder = _orders[_totalOrder - 1];
        _orders.pop();

        if (id < _totalOrder - 1)
            _orders[id] = Order(lastOrder.nft, lastOrder.id, lastOrder.owner, lastOrder.price);

        _totalOrder = _orders.length;
    }

    function set_price(uint256 id, uint256 price) external {
        require(id >= 0 && id < _totalOrder, "BestNftExchange: id out of range");
        require(_orders[id].owner == msg.sender, "BestNftExchange: not order owner");

        _orders[id].price = price;
    }

    function onERC721Received(address, address from, uint256 tokenId, bytes calldata data) external override returns (bytes4) {
        uint256 price;
        if (data.length == 0)
            price = 0;
        else {
            require(data.length != 64, "BestNftExchange: data should be an encoded uint256 value");
            price = abi.decode(data, (uint256));
        }
        Order memory order = Order(msg.sender, tokenId, from, price);

        _orders.push(order);
        _totalOrder = _orders.length;

        return IERC721Receiver.onERC721Received.selector;
    }

    function withdrawAll() external onlyAdmins {
        withdrawAmount(IERC20(token).balanceOf(address(this)));
    }
    function withdrawAmount(uint256 _amount) public onlyAdmins {
        IERC20(token).transfer(msg.sender, _amount);
    }
}
