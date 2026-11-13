// Personal data in the event log is masked: the log is exported for the public replay link.
export const mask = {
  phone: (p: string) => (p.length > 6 ? `${p.slice(0, 3)}•••••${p.slice(-4)}` : "•••"),
  email: (e: string) => {
    const [u = "", d = ""] = e.split("@");
    return `${u.slice(0, 1)}•••@${d}`;
  },
};
