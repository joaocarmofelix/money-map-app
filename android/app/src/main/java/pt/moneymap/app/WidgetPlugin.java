package pt.moneymap.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the month summary from the app, stores it and refreshes every MoneyMap widget. */
@CapacitorPlugin(name = "MoneyMapWidget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(MoneyMapWidget.PREFS, Context.MODE_PRIVATE).edit();
        e.putString("title", call.getString("title", "Este mês"));
        e.putString("amount", call.getString("amount", "—"));
        e.putString("detail", call.getString("detail", ""));
        Integer progress = call.getInt("progress", -1);
        e.putInt("progress", progress == null ? -1 : progress);
        Boolean over = call.getBoolean("over", false);
        e.putBoolean("over", over != null && over);
        e.apply();
        MoneyMapWidget.refreshAll(ctx);
        call.resolve();
    }
}
