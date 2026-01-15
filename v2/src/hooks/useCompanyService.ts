"use client";

import { useState, useEffect } from "react";
import { CompanyService, CompanyModel } from "../services/CompanyService";
import { CompanyRepository } from "../data/repositories/CompanyRepository";

const repo = new CompanyRepository();
const service = new CompanyService(repo);

export function useCompanyService() {
    const [companies, setCompanies] = useState<CompanyModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const getCompanies = async () => {
        setIsLoading(true);
        try {
            const data = await service.getCompanies();
            setCompanies(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        getCompanies();
    }, []);

    const getCompany = async (id: string) => {
        setIsLoading(true);
        try {
            return await service.getCompany(id);
        } catch (err) {
            console.error(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return { companies, isLoading, getCompanies, getCompany };
}
