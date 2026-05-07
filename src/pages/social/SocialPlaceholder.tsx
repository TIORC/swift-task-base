import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function SocialPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} icon={<Construction className="h-5 w-5"/>}/>
      <Card className="p-10 text-center">
        <div className="h-12 w-12 rounded-2xl bg-warning/10 text-warning flex items-center justify-center mx-auto mb-3">
          <Construction className="h-6 w-6"/>
        </div>
        <h2 className="font-semibold mb-1">Em construção</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Este módulo será liberado nas próximas etapas. As tabelas de banco já estão prontas para receber os dados.
        </p>
      </Card>
    </div>
  );
}
