package com.example.shop.ui;

import com.example.shop.App;
import com.example.shop.AppState;
import com.example.shop.model.Product;
import com.example.shop.util.Dialogs;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.*;
import javafx.scene.layout.*;

import java.util.List;

public class CatalogView {
    private final App app;

    public CatalogView(App app) { this.app = app; }

    public Node get() {
        BorderPane root = new BorderPane();
        root.setPadding(new Insets(10));

        Label title = new Label("Product Catalog");
        title.setStyle("-fx-font-size: 20px; -fx-font-weight: bold;");

        ComboBox<String> cbCategory = new ComboBox<>();
        cbCategory.getItems().setAll(AppState.get().categories());
        cbCategory.getSelectionModel().selectFirst();
        Button btnFilter = new Button("Filter");

        HBox filterBar = new HBox(8, new Label("Category:"), cbCategory, btnFilter);
        filterBar.setAlignment(Pos.CENTER_LEFT);

        VBox header = new VBox(10, title, filterBar);

        FlowPane grid = new FlowPane();
        grid.setHgap(12);
        grid.setVgap(12);
        grid.setPadding(new Insets(4, 0, 20, 0));
        grid.setPrefWrapLength(1000); // 每行自动换行的宽度，窗口缩放时会自适应

        ScrollPane scroller = new ScrollPane(grid);
        scroller.setFitToWidth(true);     // 随窗口宽度拉伸
        scroller.setPannable(true);       // 允许拖拽
        scroller.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scroller.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);

        // 初次渲染
        refreshGrid(grid, cbCategory.getValue());

        // 事件：筛选
        btnFilter.setOnAction(e -> refreshGrid(grid, cbCategory.getValue()));

        root.setTop(header);
        root.setCenter(scroller);
        return root;
    }

    private void refreshGrid(FlowPane grid, String category) {
        grid.getChildren().clear();
        List<Product> list = AppState.get().listProducts(category);
        for (Product p : list) {
            grid.getChildren().add(buildCard(p));
        }
    }

    private Node buildCard(Product p) {
        VBox card = new VBox(6);
        card.setPadding(new Insets(10));
        card.setStyle("-fx-border-color: #ddd; -fx-border-radius: 6; -fx-background-radius: 6; -fx-background-color: #fafafa;");
        card.setPrefWidth(220);

        Label name = new Label(p.getName());
        name.setStyle("-fx-font-weight: bold;");

        Label price = new Label(String.format("$%.2f", p.getPrice()));
        Label stock = new Label("Stock: " + p.getStock());
        Label cat   = new Label("Category: " + p.getCategory());
        Label desc  = new Label(p.getDescription());
        desc.setWrapText(true);

        HBox qtyRow = new HBox(6, new Label("Qty:"), new TextField("1"));
        TextField qtyField = (TextField) qtyRow.getChildren().get(1);
        qtyField.setPrefColumnCount(3);

        Button add = new Button("Add to Cart");
        add.setDisable(p.getStock() <= 0);
        add.setOnAction(e -> {
            try {
                int qty = Integer.parseInt(qtyField.getText().trim());
                AppState.get().addToCart(p, qty);
                Dialogs.info("Added", "Added to cart.");
            } catch (NumberFormatException ex) {
                Dialogs.error("Invalid qty", "Quantity must be an integer.");
            } catch (Exception ex) {
                Dialogs.error("Cannot add", ex.getMessage());
            }
        });

        card.getChildren().addAll(name, price, stock, cat, desc, qtyRow, add);
        return card;
    }
}
