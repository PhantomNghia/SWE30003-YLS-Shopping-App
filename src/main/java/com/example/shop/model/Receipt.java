// Receipt.java
package com.example.shop.model;

public class Receipt {
    private final String id;
    private final String orderId;
    private final double amount;
    private final String issuedAt;
    private final String text;

    public Receipt(String id, String orderId, double amount, String issuedAt, String text) {
        this.id=id; this.orderId=orderId; this.amount=amount; this.issuedAt=issuedAt; this.text=text;
    }
    public String getId(){return id;}
    public String getOrderId(){return orderId;}
    public double getAmount(){return amount;}
    public String getIssuedAt(){return issuedAt;}
    public String getText(){return text;}
}
