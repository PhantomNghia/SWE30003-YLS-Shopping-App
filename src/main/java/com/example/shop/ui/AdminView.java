package com.example.shop.ui;

import com.example.shop.App;
import com.example.shop.AppState;
import com.example.shop.model.Product;
import com.example.shop.util.Dialogs;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.*;
import javafx.scene.layout.*;

public class AdminView {
    private final App app;

    public AdminView(App app) { this.app = app; }

    public Node get() {
        BorderPane root = new BorderPane();
        root.setPadding(new Insets(10));

        Label title = new Label("Admin - Product Management");
        title.setStyle("-fx-font-size: 20px; -fx-font-weight: bold;");
        root.setTop(title);
        BorderPane.setMargin(title, new Insets(0,0,10,0));

        TableView<Product> table = new TableView<>();
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        TableColumn<Product, String> cId   = new TableColumn<>("ID");
        TableColumn<Product, String> cName = new TableColumn<>("Name");
        TableColumn<Product, String> cCat  = new TableColumn<>("Category");
        TableColumn<Product, Number> cPrice= new TableColumn<>("Price");
        TableColumn<Product, Number> cStock= new TableColumn<>("Stock");
        TableColumn<Product, Boolean> cAct = new TableColumn<>("Active");

        cId.setCellValueFactory(d -> new SimpleStringProperty(d.getValue().getId()));
        cName.setCellValueFactory(d -> new SimpleStringProperty(d.getValue().getName()));
        cCat.setCellValueFactory(d -> new SimpleStringProperty(d.getValue().getCategory()));
        cPrice.setCellValueFactory(d -> new SimpleDoubleProperty(d.getValue().getPrice()));
        cStock.setCellValueFactory(d -> new SimpleIntegerProperty(d.getValue().getStock()));
        cAct.setCellValueFactory(d -> new SimpleBooleanProperty(d.getValue().isActive()));

        table.getColumns().addAll(cId, cName, cCat, cPrice, cStock, cAct);
        refreshTable(table);

        TextField fId = new TextField();      fId.setPromptText("Unique ID e.g., P3001");
        TextField fName = new TextField();    fName.setPromptText("Product name");
        TextField fCat = new TextField();     fCat.setPromptText("Category");
        TextField fPrice = new TextField();   fPrice.setPromptText("Price > 0");
        TextField fStock = new TextField();   fStock.setPromptText("Stock >= 0");
        TextArea  fDesc = new TextArea();     fDesc.setPromptText("Description");
        CheckBox  fActive = new CheckBox("Active (listed in catalogue)");
        fActive.setSelected(true);

        GridPane form = new GridPane();
        form.setHgap(8); form.setVgap(8);
        form.addRow(0, new Label("ID:"), fId);
        form.addRow(1, new Label("Name:"), fName);
        form.addRow(2, new Label("Category:"), fCat);
        form.addRow(3, new Label("Price:"), fPrice);
        form.addRow(4, new Label("Stock:"), fStock);
        form.addRow(5, new Label("Description:"), fDesc);
        form.add(fActive, 1, 6);

        // 操作按钮
        Button btnNew = new Button("New");
        Button btnSave = new Button("Save");
        Button btnDelete = new Button("Delete");
        Button btnToggle = new Button("Toggle Active");
        Button btnStockPlus = new Button("+ Stock");
        Button btnStockMinus= new Button("- Stock");

        HBox ops = new HBox(8, btnNew, btnSave, btnDelete, btnToggle, btnStockPlus, btnStockMinus);
        ops.setAlignment(Pos.CENTER_LEFT);

        VBox right = new VBox(10, form, ops);
        right.setPadding(new Insets(0,0,0,10));
        root.setRight(right);
        root.setCenter(table);

        table.getSelectionModel().selectedItemProperty().addListener((obs, oldV, v) -> {
            if (v == null) return;
            fId.setText(v.getId());      fId.setDisable(true); // ID 不允许改
            fName.setText(v.getName());
            fCat.setText(v.getCategory());
            fPrice.setText(String.valueOf(v.getPrice()));
            fStock.setText(String.valueOf(v.getStock()));
            fDesc.setText(v.getDescription());
            fActive.setSelected(v.isActive());
        });

        btnNew.setOnAction(e -> {
            fId.setDisable(false);
            fId.clear(); fName.clear(); fCat.clear(); fPrice.clear(); fStock.clear(); fDesc.clear();
            fActive.setSelected(true);
            table.getSelectionModel().clearSelection();
        });

        btnSave.setOnAction(e -> {
            try {
                String id = fId.getText().trim();
                String name = fName.getText().trim();
                String cat = fCat.getText().trim();
                double price = Double.parseDouble(fPrice.getText().trim());
                int stock = Integer.parseInt(fStock.getText().trim());
                String desc = fDesc.getText();
                boolean active = fActive.isSelected();

                if (fId.isDisabled()) {
                    AppState.get().updateProduct(id, name, cat, price, stock, desc, active);
                } else {
                    AppState.get().createProduct(id, name, cat, price, stock, desc, active);
                    fId.setDisable(true);
                }
                Dialogs.info("Saved", "Product saved.");
                refreshTable(table);
            } catch (NumberFormatException ex) {
                Dialogs.error("Invalid number", "Price must be a number > 0; Stock must be an integer >= 0.");
            } catch (Exception ex) {
                Dialogs.error("Save failed", ex.getMessage());
            }
        });

        // Delete
        btnDelete.setOnAction(e -> {
            Product sel = table.getSelectionModel().getSelectedItem();
            if (sel == null) { Dialogs.error("No selection","Select a product first."); return; }
            if (Dialogs.confirm("Delete", "Delete product "+sel.getId()+" ?")) {
                try {
                    AppState.get().deleteProduct(sel.getId());
                    refreshTable(table);
                    btnNew.fire();
                } catch (Exception ex) {
                    Dialogs.error("Delete failed", ex.getMessage());
                }
            }
        });

        // Toggle Active
        btnToggle.setOnAction(e -> {
            Product sel = table.getSelectionModel().getSelectedItem();
            if (sel == null) { Dialogs.error("No selection","Select a product first."); return; }
            try {
                AppState.get().toggleActive(sel.getId(), !sel.isActive());
                refreshTable(table);
            } catch (Exception ex) {
                Dialogs.error("Failed", ex.getMessage());
            }
        });

        btnStockPlus.setOnAction(e -> adjustStock(table, +1));
        btnStockMinus.setOnAction(e -> adjustStock(table, -1));

        return root;
    }

    private void adjustStock(TableView<Product> table, int delta) {
        Product sel = table.getSelectionModel().getSelectedItem();
        if (sel == null) { Dialogs.error("No selection","Select a product first."); return; }
        try {
            AppState.get().adjustStock(sel.getId(), delta);
            refreshTable(table);
        } catch (Exception ex) {
            Dialogs.error("Stock failed", ex.getMessage());
        }
    }

    private void refreshTable(TableView<Product> table) {
        table.getItems().setAll(AppState.get().listAllProducts());
    }
}
