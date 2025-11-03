// Order.java
package com.example.shop.model;

import java.util.List;

public class Order {
    private final String id;
    private final String customerId;
    private final List<OrderItem> items;
    private final String line1, city, postCode;
    private final double total;
    private String status; // PENDING / PAID / CANCELLED
    private final String createdAt;
    private Receipt receipt;

    public Order(String id, String customerId, List<OrderItem> items,
                 String line1, String city, String postCode,
                 double total, String status, String createdAt) {
        this.id=id; this.customerId=customerId; this.items=items;
        this.line1=line1; this.city=city; this.postCode=postCode;
        this.total=total; this.status=status; this.createdAt=createdAt;
    }
    public String getId(){return id;}
    public List<OrderItem> getItems(){return items;}
    public String getAddress(){return line1+", "+city+" "+postCode;}
    public double getTotal(){return total;}
    public String getStatus(){return status;}
    public void setStatus(String s){this.status=s;}
    public String getCreatedAt(){return createdAt;}
    public Receipt getReceipt(){return receipt;}
    public void setReceipt(Receipt r){this.receipt=r;}
}
