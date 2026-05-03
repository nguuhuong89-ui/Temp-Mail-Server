import { AdminLayout } from "@/components/layout/admin-layout";
import { useListAllEmails, useListDomains } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, Eye } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export default function EmailsExplorer() {
  const [search, setSearch] = useState("");
  const [domainId, setDomainId] = useState<string>("all");

  const { data: domains } = useListDomains();
  const { data: emails, isLoading } = useListAllEmails({
    search: search || undefined,
    domainId: domainId !== "all" ? Number(domainId) : undefined,
    limit: 50
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Emails</h1>
          <p className="text-muted-foreground">Browse all emails received across all inboxes.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by subject or address..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {domains?.map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card border rounded-lg shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>To</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="w-1/3">Subject</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !emails?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No emails found.
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">{email.toAddress}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">{email.fromAddress}</TableCell>
                    <TableCell className="text-sm truncate max-w-[200px] font-medium">
                      {email.subject || "No Subject"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/email/${email.id}`}>
                          <Eye className="h-4 w-4 mr-2" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
