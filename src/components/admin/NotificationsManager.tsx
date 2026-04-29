import { useState } from "react";
import NotificationComposer from "@/components/notifications/NotificationComposer";
import BroadcastHistory from "@/components/notifications/BroadcastHistory";

const NotificationsManager = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <NotificationComposer mode="admin" onSent={() => setRefreshKey((k) => k + 1)} />
      <div key={refreshKey}>
        <BroadcastHistory scope="all" />
      </div>
    </div>
  );
};

export default NotificationsManager;
