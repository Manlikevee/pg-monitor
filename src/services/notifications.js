import * as Notifications from 'expo-notifications';

function isQuiet(preferences) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = value => {
    const [hour, minute] = String(value || '').split(':').map(Number);
    return hour * 60 + (minute || 0);
  };
  const start = toMin(preferences.quietStart);
  const end = toMin(preferences.quietEnd);
  return start > end ? minutes >= start || minutes < end : minutes >= start && minutes < end;
}

async function deliver(title, body, databaseId) {
  try {
    const current = await Notifications.getPermissionsAsync();
    const status = current.status === 'granted'
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;
    await Notifications.scheduleNotificationAsync({
      content: {title, body, data: databaseId ? {databaseId} : {}},
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendTestNotification() {
  return deliver('PG Monitor test notification', 'Local notifications are working on this device.');
}

export async function notifyCheckOutcome({database, success, latencyMs, preferences, previousStatus, failures}) {
  if (!preferences?.notifications || isQuiet(preferences)) return false;

  let title;
  let body;
  let offlineAlert = false;
  if (!success && preferences.failureAlerts) {
    title = 'Connection check failed';
    body = `${database.name} did not respond. Consecutive failures: ${failures}.`;
    offlineAlert = preferences.offlineAlerts
      && failures >= (preferences.failuresBeforeAlert || 2)
      && !database.offlineAlertSent;
  } else if (!success && preferences.offlineAlerts
    && failures >= (preferences.failuresBeforeAlert || 2)
    && !database.offlineAlertSent) {
    title = 'Database offline';
    body = `${database.name} is unreachable after ${failures} failed checks.`;
    offlineAlert = true;
  } else if (success && preferences.successAlerts) {
    title = previousStatus === 'offline' && preferences.recoveryAlerts
      ? 'Database recovered'
      : 'Connection check succeeded';
    body = `${database.name} responded${latencyMs ? ` in ${latencyMs} ms` : ''}.`;
  } else if (success && previousStatus === 'offline' && preferences.recoveryAlerts) {
    title = 'Database recovered';
    body = `${database.name} is responding again${latencyMs ? ` in ${latencyMs} ms` : ''}.`;
  }

  if (!title) return false;
  const delivered = await deliver(title, body, database.id);
  return offlineAlert && delivered;
}

export async function notifySuccessRateDrop({database, history, preferences}) {
  if (!preferences?.notifications || !preferences?.successRateAlerts || isQuiet(preferences)) return;
  const relevant = history.filter(event => event.databaseId === database.id && ['success', 'failed'].includes(event.type)).slice(0, 100);
  if (relevant.length < 5) return;
  const threshold = Number(preferences.threshold) || 95;
  const rate = 100 * relevant.filter(event => event.type === 'success').length / relevant.length;
  const prior = relevant.slice(1);
  if (rate >= threshold || prior.length < 4) return;
  const priorRate = 100 * prior.filter(event => event.type === 'success').length / prior.length;
  if (priorRate < threshold) return;
  await deliver('Success rate below target', `${database.name} has a ${Math.round(rate)}% success rate, below your ${threshold}% threshold.`, database.id);
}
