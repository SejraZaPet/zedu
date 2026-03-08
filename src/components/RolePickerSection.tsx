import { BookOpen, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const roles = [
  {
    icon: BookOpen,
    title: "Jsem učitel",
    description:
      "Chci vytvářet digitální učebnice, aktivity a vlastní výukové materiály.",
    to: "/admin",
  },
  {
    icon: GraduationCap,
    title: "Jsem žák",
    description:
      "Chci procvičovat učivo, řešit interaktivní úkoly a sledovat svůj pokrok.",
    to: "/student",
  },
];

const RolePickerSection = () => {
  const navigate = useNavigate();

  return (
    <section className="w-full py-20 md:py-28 bg-gradient-to-br from-[hsl(185,55%,42%)] to-[hsl(260,55%,55%)]">
      <div className="container mx-auto max-w-3xl px-4 text-center">
        <h2 className="font-heading text-2xl md:text-4xl font-bold text-white mb-4">
          Nevíte, kde začít?
        </h2>
        <p className="text-white/80 text-base md:text-lg max-w-xl mx-auto mb-12 leading-relaxed">
          ZEdu nabízí nástroje jak pro učitele, tak pro žáky. Vyberte si svou
          cestu.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((role) => (
            <button
              key={role.title}
              onClick={() => navigate(role.to)}
              className="group bg-card rounded-2xl p-8 text-left shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-0"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-brand flex items-center justify-center mb-5">
                <role.icon size={28} className="text-primary-foreground" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
                {role.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {role.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RolePickerSection;
