package com.example.shop.util;

import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TextInputDialog;

import java.util.Optional;

public class Dialogs {
    public static void info(String title, String msg) {
        Alert a = new Alert(Alert.AlertType.INFORMATION, msg, ButtonType.OK);
        a.setHeaderText(title);
        a.showAndWait();
    }
    public static void error(String title, String msg) {
        Alert a = new Alert(Alert.AlertType.ERROR, msg, ButtonType.OK);
        a.setHeaderText(title);
        a.showAndWait();
    }
    public static boolean confirm(String title, String msg) {
        Alert a = new Alert(Alert.AlertType.CONFIRMATION, msg, ButtonType.OK, ButtonType.CANCEL);
        a.setHeaderText(title);
        Optional<ButtonType> r = a.showAndWait();
        return r.isPresent() && r.get()==ButtonType.OK;
    }
    public static Optional<String> prompt(String title, String header, String defaultValue) {
        TextInputDialog d = new TextInputDialog(defaultValue);
        d.setTitle(title);
        d.setHeaderText(header);
        return d.showAndWait();
    }
}
