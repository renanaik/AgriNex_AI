
function StatCard({ title, value, description }) {
  return (
    <div className="stat-card">
      <p className="stat-title">{title}</p>
      <h2>{value}</h2>
      <p className="stat-description">{description}</p>
    </div>
  );
}

export default StatCard;
