package pt.moneymap.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Home-screen widget: this month's spending, a budget bar and a "+" that opens
 * the app straight on "add a movement". The numbers come from the app (WidgetPlugin).
 */
public class MoneyMapWidget extends AppWidgetProvider {
    static final String PREFS = "moneymap_widget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, views(ctx));
    }

    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, MoneyMapWidget.class));
        for (int id : ids) mgr.updateAppWidget(id, views(ctx));
    }

    static RemoteViews views(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_moneymap);
        v.setTextViewText(R.id.w_title, p.getString("title", "Este mês"));
        v.setTextViewText(R.id.w_amount, p.getString("amount", "—"));
        v.setTextViewText(R.id.w_detail, p.getString("detail", "Abre a app para atualizar"));
        int progress = p.getInt("progress", -1);
        boolean over = p.getBoolean("over", false);
        if (progress >= 0) {
            v.setViewVisibility(over ? R.id.w_bar_over : R.id.w_bar, View.VISIBLE);
            v.setViewVisibility(over ? R.id.w_bar : R.id.w_bar_over, View.GONE);
            v.setProgressBar(over ? R.id.w_bar_over : R.id.w_bar, 100, Math.min(100, progress), false);
        } else {
            v.setViewVisibility(R.id.w_bar, View.GONE);
            v.setViewVisibility(R.id.w_bar_over, View.GONE);
        }
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, "moneymap://home", 1));
        v.setOnClickPendingIntent(R.id.w_add, open(ctx, "moneymap://add", 2));
        return v;
    }

    private static PendingIntent open(Context ctx, String uri, int requestCode) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri), ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
