// Expiry is enforced on every redirect. Keep expired records and their aliases
// for management and recovery; never delete them on a periodic timer.
// Only explicitly enabled analytics retention removes expired hourly aggregates.
require("./analytics-privacy").start();
require("./webhooks").start();
require("./link-health").start();
