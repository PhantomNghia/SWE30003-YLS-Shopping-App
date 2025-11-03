// CartItem.java
package com.example.shop.model;

public class CartItem {
    private final String productId;
    private final String name;
    private final double unitPrice;
    private int qty;

    public CartItem(String productId, String name, double unitPrice, int qty) {
        this.productId=productId; this.name=name; this.unitPrice=unitPrice; this.qty=qty;
    }
    public String getProductId(){return productId;}
    public String getName(){return name;}
    public double getUnitPrice(){return unitPrice;}
    public int getQty(){return qty;}
    public void setQty(int q){this.qty=q;}
    public double getSubTotal(){return unitPrice*qty;}
}
