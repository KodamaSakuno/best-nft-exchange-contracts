// SPDX-License-Identifier: MIT

pragma solidity ^0.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Receiver.sol";

import "./Administrable.sol";

contract BestNftExchange is Administrable, ERC1155Receiver {
    using SafeERC20 for IERC20;

    IERC20 public token;

    struct Order {
        IERC1155 nft;
        uint256 id;
        uint256 amount;
        address owner;
        uint256 price;
    }
    Order[] private _orders;
    uint256 private _totalOrder;

    constructor(address _token) public {
        token = IERC20(_token);
    }

    function totalOrder() external view returns (uint256) {
        return _totalOrder;
    }
    function getOrders() external view returns (Order[] memory result) {
        result = new Order[](_totalOrder);

        for (uint256 i = 0; i < _totalOrder; i++)
            result[i] = _orders[i];
    }
    function getOrder(uint256 id) external view returns (Order memory) {
        require(id >= 0 && id < _totalOrder, "BestNftExchange: id out of range");
        return _orders[id];
    }

    function buy(uint256 id) external {
        require(id >= 0 && id < _totalOrder, "BestNftExchange: id out of range");
        Order memory order = _orders[id];
        uint256 buyerBalance = token.balanceOf(msg.sender);
        require(buyerBalance >= order.price, "BestNftExchange: insufficient balance");

        token.safeTransferFrom(msg.sender, order.owner, order.price);
        order.nft.safeTransferFrom(address(this), msg.sender, order.id, order.amount, "");

        removeOrder(id);
    }

    function revoke(uint256 id) external {
        require(id >= 0 && id < _totalOrder, "BestNftExchange: id out of range");
        Order memory order = _orders[id];
        require(order.owner == msg.sender, "BestNftExchange: not order owner");

        order.nft.safeTransferFrom(address(this), msg.sender, order.id, order.amount, "");

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
            _orders[id] = Order(lastOrder.nft, lastOrder.id, lastOrder.amount, lastOrder.owner, lastOrder.price);

        _totalOrder = _orders.length;
    }

    function set_price(uint256 id, uint256 price) external {
        require(id >= 0 && id < _totalOrder, "BestNftExchange: id out of range");
        require(_orders[id].owner == msg.sender, "BestNftExchange: not order owner");

        _orders[id].price = price;
    }

    function onERC1155Received(address, address from, uint256 id, uint256 value, bytes calldata data) external override returns (bytes4) {
        uint256 price;
        if (data.length == 0)
            price = 0;
        else
            price = abi.decode(data, (uint256));

        Order memory order = Order(IERC1155(msg.sender), id, value, from, price);

        _orders.push(order);
        _totalOrder = _orders.length;

        return IERC1155Receiver.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external override returns (bytes4) {
        uint256[] memory prices = abi.decode(data, (uint256[]));
        require(prices.length == ids.length, "BestNftExchange: prices count mismatch");

        for (uint256 i = 0; i < ids.length; i++)
            _orders.push(Order(IERC1155(msg.sender), ids[i], values[i], from, prices[i]));

        _totalOrder = _orders.length;

        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function withdrawAll() external onlyAdmins {
        withdrawAmount(token.balanceOf(address(this)));
    }
    function withdrawAmount(uint256 _amount) public onlyAdmins {
        token.transfer(msg.sender, _amount);
    }
}
