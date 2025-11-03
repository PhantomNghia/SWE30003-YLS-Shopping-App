package com.example.shop.model;

public class Product {
    private final String id;
    private final String name;
    private final String category;
    private final double price;
    private int stock;
    private final String description;
    private boolean active = true;

    public Product(String id, String name, String category, double price, int stock, String description) {
        this.id=id; this.name=name; this.category=category; this.price=price; this.stock=stock; this.description=description;
        this.active = true; // 默认上架
    }

    public String getId(){return id;}
    public String getName(){return name;}
    public String getCategory(){return category;}
    public double getPrice(){return price;}
    public int getStock(){return stock;}
    public void setStock(int s){this.stock=s;}
    public String getDescription(){return description;}
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}


